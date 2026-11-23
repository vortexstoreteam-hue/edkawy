import crypto from 'node:crypto';
import { getPaymobHmacSecret, safeEqualStrings } from '../config/env.js';

export function verifyAndParsePaymobWebhook(params: {
  signature: string;
  body: Record<string, unknown>;
}): { status: number; body: Record<string, unknown> } {
  const hmacSecret = getPaymobHmacSecret();
  if (!hmacSecret) {
    return {
      status: 503,
      body: {
        received: false,
        error: 'Paymob webhook HMAC secret is not configured on the server.',
      },
    };
  }

  const signature = params.signature.trim().toLowerCase();
  if (!signature || !/^[a-f0-9]{128}$/.test(signature)) {
    return {
      status: 401,
      body: {
        received: false,
        error: 'Missing or malformed Paymob HMAC signature.',
      },
    };
  }

  const obj = (
    typeof params.body.obj === 'object' && params.body.obj !== null
      ? params.body.obj
      : params.body
  ) as Record<string, unknown>;

  const orderObj =
    typeof obj.order === 'object' && obj.order !== null
      ? (obj.order as Record<string, unknown>)
      : {};
  const sourceData =
    typeof obj.source_data === 'object' && obj.source_data !== null
      ? (obj.source_data as Record<string, unknown>)
      : {};

  const amountCents = String(obj.amount_cents ?? '');
  const createdAt = String(obj.created_at ?? '');
  const currency = String(obj.currency ?? 'EGP');
  const errorOccurred = String(obj.error_occured ?? false);
  const hasParentTrans = String(obj.has_parent_transaction ?? false);
  const id = String(obj.id ?? '');
  const integrationId = String(obj.integration_id ?? '');
  const is3dSecure = String(obj.is_3d_secure ?? false);
  const isAuth = String(obj.is_auth ?? false);
  const isCapture = String(obj.is_capture ?? false);
  const isRefunded = String(obj.is_refunded ?? false);
  const isStandalonePayment = String(obj.is_standalone_payment ?? false);
  const isVoided = String(obj.is_voided ?? false);
  const orderId = String(orderObj.id ?? obj.order_id ?? obj.special_reference ?? '');
  const owner = String(obj.owner ?? '');
  const pending = String(obj.pending ?? false);
  const sourceDataPan = String(sourceData.pan ?? '');
  const sourceDataSubType = String(sourceData.sub_type ?? '');
  const sourceDataType = String(sourceData.type ?? '');
  const success = String(obj.success ?? false);

  const concatenated = `${amountCents}${createdAt}${currency}${errorOccurred}${hasParentTrans}${id}${integrationId}${is3dSecure}${isAuth}${isCapture}${isRefunded}${isStandalonePayment}${isVoided}${orderId}${owner}${pending}${sourceDataPan}${sourceDataSubType}${sourceDataType}${success}`;
  const calculatedHmac = crypto
    .createHmac('sha512', hmacSecret)
    .update(concatenated)
    .digest('hex')
    .toLowerCase();

  if (!safeEqualStrings(signature, calculatedHmac)) {
    return {
      status: 401,
      body: {
        received: false,
        error: 'Invalid Paymob HMAC signature.',
      },
    };
  }

  const isTransactionSuccess = obj.success === true || obj.success === 'true';
  return {
    status: 200,
    body: {
      received: true,
      orderId,
      status: isTransactionSuccess ? 'confirmed' : 'payment_failed',
      signatureValid: true,
      timestamp: new Date().toISOString(),
    },
  };
}
