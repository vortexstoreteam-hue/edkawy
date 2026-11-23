import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map,
  MapMouseEvent,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Bike,
  Flame,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Pill,
  Radio,
  Route as RouteIcon,
  Search,
  Star,
  Store,
  X,
} from 'lucide-react';
import {
  clampToEdkuServiceBounds,
  EDKU_CITY_CENTER,
  EDKU_NEIGHBORHOOD_COORDS,
  EDKU_SERVICE_BOUNDS,
  isWithinEdkuServiceBounds,
  resolveEdkuCoordsForNeighborhood,
  resolveNearestEdkuNeighborhood,
} from '../data/edkuSeedStores';
import { reverseGeocodeCoordinates } from '../services/edkawiFirebaseService';
import { CourierRecord, OrderRecord, StoreRecord } from '../types/edkawi';
import {
  EDKU_NEIGHBORHOODS,
  isEdkuWaterCoordinate,
  isStoreCurrentlyOpen,
} from '../utils/orderLogic';

const EDKU_MAP_RESTRICTION = {
  latLngBounds: { ...EDKU_SERVICE_BOUNDS },
  strictBounds: false,
};

const OUTSIDE_EDKU_GOVERNORATE_PATTERN =
  /(الإسكندرية|الاسكندرية|القاهرة|الجيزة|طنطا|المنصورة|دمنهور|كفر الدوار|مطروح|دمياط|بورسعيد|السويس|أسيوط|سوهاج|أسوان)/;

const HAS_MAPS_API_KEY = Boolean(
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY &&
    String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY).trim()
);

const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

function checkAndEmitGmpQuotaError(err: unknown): void {
  if (typeof window === 'undefined' || !err) return;
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

/* ============================================================================
 * INTERNAL SDK HELPERS (Modern Routes Polyline + Demand Thermal Circles)
 * ========================================================================== */

interface GmpLatLngLiteral {
  lat: number;
  lng: number;
}

interface GmpOverlayHandle {
  setMap: (map: unknown | null) => void;
}

interface GmpBoundsHandle {
  extend: (pt: GmpLatLngLiteral) => void;
}

interface GmpMapsNamespace {
  Polyline: new (opts: Record<string, unknown>) => GmpOverlayHandle;
  Circle: new (opts: Record<string, unknown>) => GmpOverlayHandle;
  LatLngBounds: new () => GmpBoundsHandle;
}

function getRuntimeGoogleMaps(): GmpMapsNamespace | null {
  if (typeof window === 'undefined') return null;
  const g = (window as unknown as { google?: { maps?: GmpMapsNamespace } })
    .google;
  return g?.maps ?? null;
}

interface SdkRoutePolylineProps {
  waypoints: Array<{ lat: number; lng: number }>;
  strokeColor?: string;
  fitBounds?: boolean;
}

const SdkRoutePolylineLayer: React.FC<SdkRoutePolylineProps> = ({
  waypoints,
  strokeColor = '#FF7100',
  fitBounds = false,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');

  useEffect(() => {
    const gmaps = getRuntimeGoogleMaps();
    if (!map || waypoints.length < 2 || !gmaps) return;

    let cancelled = false;
    let activePolyline: GmpOverlayHandle | null = null;

    const drawPath = (path: Array<unknown>) => {
      if (cancelled) return;
      if (activePolyline) {
        activePolyline.setMap(null);
      }
      activePolyline = new gmaps.Polyline({
        path,
        geodesic: true,
        strokeColor,
        strokeOpacity: 0.92,
        strokeWeight: 4,
        map,
      });

      if (fitBounds && waypoints.length >= 2) {
        const bounds = new gmaps.LatLngBounds();
        waypoints.forEach((pt) => bounds.extend(pt));
        (
          map as unknown as {
            fitBounds?: (b: GmpBoundsHandle, padding?: number) => void;
          }
        ).fitBounds?.(bounds, 48);
      }
    };

    // Draw immediate geodesic multi-stop path first so route is instant, then upgrade via Route.computeRoutes if 2-stop or intermediate supported
    drawPath(waypoints);

    const anyRoutesLib = routesLib as unknown as {
      Route?: {
        new (): {
          computeRoutes: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              polyline?: { encodedPolyline?: string };
            }>;
          }>;
        };
        decode?: (encoded: string) => unknown[];
      };
      TravelMode?: Record<string, unknown>;
    } | null;

    if (anyRoutesLib?.Route && waypoints.length === 2) {
      try {
        const routeService = new anyRoutesLib.Route();
        const travelMode = anyRoutesLib.TravelMode?.DRIVING ?? 'DRIVING';
        routeService
          .computeRoutes({
            origin: waypoints[0],
            destination: waypoints[waypoints.length - 1],
            travelMode,
            fields: ['polyline', 'viewport'],
          })
          .then((res) => {
            if (cancelled) return;
            const encoded = res?.routes?.[0]?.polyline?.encodedPolyline;
            if (encoded && typeof anyRoutesLib.Route?.decode === 'function') {
              const decodedPath = anyRoutesLib.Route.decode(encoded);
              if (decodedPath.length >= 2) {
                drawPath(decodedPath);
              }
            }
          })
          .catch((err) => {
            checkAndEmitGmpQuotaError(err);
            // Keep geodesic polyline fallback silently
          });
      } catch {
        // Keep geodesic polyline fallback
      }
    }

    return () => {
      cancelled = true;
      if (activePolyline) {
        activePolyline.setMap(null);
      }
    };
  }, [map, routesLib, waypoints, strokeColor, fitBounds]);

  return null;
};

interface ThermalZoneItem {
  neighborhood: string;
  center: { lat: number; lng: number };
  count: number;
  intensity: number; // 0.25 .. 1
}

const DemandThermalCirclesLayer: React.FC<{
  zones: ThermalZoneItem[];
  enabled: boolean;
}> = ({ zones, enabled }) => {
  const map = useMap();

  useEffect(() => {
    const gmaps = getRuntimeGoogleMaps();
    if (!map || !enabled || !gmaps) return;

    const circles = zones.map((zone) => {
      const color =
        zone.intensity >= 0.75
          ? '#EF4444'
          : zone.intensity >= 0.45
          ? '#FF7100'
          : '#F59E0B';
      return new gmaps.Circle({
        map,
        center: zone.center,
        radius: Math.round(240 + zone.intensity * 320),
        fillColor: color,
        fillOpacity: Number((0.18 + zone.intensity * 0.22).toFixed(2)),
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeWeight: 1.5,
        clickable: false,
      });
    });

    return () => {
      circles.forEach((c) => c.setMap(null));
    };
  }, [map, zones, enabled]);

  return null;
};

/* ============================================================================
 * 1. CUSTOMER HOME STORES & PHARMACIES MAP
 * ========================================================================== */

interface EdkuStoresMapProps {
  stores: StoreRecord[];
  onSelectStore: (store: StoreRecord) => void;
}

export const EdkuStoresMap: React.FC<EdkuStoresMapProps> = ({
  stores,
  onSelectStore,
}) => {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const storesWithCoords = useMemo(
    () =>
      stores.map((store, index) => {
        const fallback = resolveEdkuCoordsForNeighborhood(store.neighborhood);
        const jitterLat = ((index % 3) - 1) * 0.0007;
        const jitterLng = ((Math.floor(index / 3) % 3) - 1) * 0.0007;
        const lat =
          typeof store.lat === 'number' && !Number.isNaN(store.lat)
            ? store.lat
            : Number((fallback.lat + jitterLat).toFixed(6));
        const lng =
          typeof store.lng === 'number' && !Number.isNaN(store.lng)
            ? store.lng
            : Number((fallback.lng + jitterLng).toFixed(6));
        return { store, position: { lat, lng } };
      }),
    [stores]
  );

  const activeInfoEntry = useMemo(
    () =>
      storesWithCoords.find((entry) => entry.store.id === selectedStoreId) ??
      null,
    [storesWithCoords, selectedStoreId]
  );

  if (!HAS_MAPS_API_KEY) {
    return (
      <div className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 text-center space-y-2">
        <MapPin className="w-7 h-7 text-[#FF7100] mx-auto" />
        <p className="text-sm font-semibold text-[#F8FAFC]">
          خريطة متاجر وصيدليات إدكو التفاعلية غير مفعلة حالياً
        </p>
        <p className="text-xs text-[#94A3B8]">
          تأكد من تفعيل مفتاح خرائط Google لعرض مواقع المتاجر الحية في مدينة إدكو.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="خريطة متاجر وصيدليات مدينة إدكو"
      className="rounded-2xl bg-[#1E293B] border border-[#334155] overflow-hidden"
    >
      <div className="px-5 py-3.5 border-b border-[#334155] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#FF7100] shrink-0" />
          <h2 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
            خريطة متاجر وصيدليات مدينة إدكو
          </h2>
        </div>
        <span className="text-xs text-[#94A3B8] tabular-nums">
          {storesWithCoords.length} موقع مسجل على الخريطة · مركز إدكو
        </span>
      </div>

      <div className="h-[340px] sm:h-[380px] w-full relative">
        <Map
          className="w-full h-full"
          mapId="DEMO_MAP_ID"
          defaultCenter={EDKU_CITY_CENTER}
          defaultZoom={14}
          minZoom={12}
          restriction={EDKU_MAP_RESTRICTION}
          gestureHandling="greedy"
          internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
        >
          {storesWithCoords.map(({ store, position }) => {
            const open = isStoreCurrentlyOpen(store);
            const isPharmacy = store.category === 'صيدليات';
            return (
              <AdvancedMarker
                key={store.id}
                position={position}
                title={store.name}
                onClick={() => setSelectedStoreId(store.id)}
              >
                <Pin
                  background={
                    !open ? '#64748B' : isPharmacy ? '#0D9488' : '#FF7100'
                  }
                  borderColor="#1E293B"
                  glyphColor="#FFFFFF"
                  scale={1.15}
                />
              </AdvancedMarker>
            );
          })}

          {activeInfoEntry && (
            <InfoWindow
              position={activeInfoEntry.position}
              onCloseClick={() => setSelectedStoreId(null)}
            >
              <div
                dir="rtl"
                className="min-w-[215px] max-w-[260px] p-1 text-right font-sans text-slate-900 space-y-2 keep-light-surface"
              >
                <div className="text-xs text-slate-500">
                  {activeInfoEntry.store.category} ·{' '}
                  {activeInfoEntry.store.neighborhood}
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {activeInfoEntry.store.name}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    {activeInfoEntry.store.rating.toFixed(1)}
                    {activeInfoEntry.store.reviewCount
                      ? ` (${activeInfoEntry.store.reviewCount})`
                      : ''}
                  </span>
                  <span>
                    توصيل {activeInfoEntry.store.deliveryFee} ج.م ·{' '}
                    {isStoreCurrentlyOpen(activeInfoEntry.store)
                      ? 'مفتوح'
                      : 'مغلق'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStore(activeInfoEntry.store)}
                  className="w-full py-2 px-3 rounded-lg bg-[#FF7100] hover:bg-[#E66600] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {activeInfoEntry.store.category === 'صيدليات'
                    ? 'إرسال روشتة أو طلب أدوية'
                    : 'تصفح المنيو والطلب'}
                </button>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </section>
  );
};

/* ============================================================================
 * 2. INTERACTIVE MAP LOCATION PICKER (Customer / Store / Courier)
 * ========================================================================== */

export interface EdkuPickedLocation {
  lat: number;
  lng: number;
  neighborhood: string;
  resolvedAddress?: string;
}

interface EdkuLocationPickerMapProps {
  label?: string;
  helperText?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  onChange: (picked: EdkuPickedLocation) => void;
  onAddressResolved?: (resolvedAddress: string) => void;
  onWaterValidationChange?: (isWater: boolean) => void;
  autoLocateOnMount?: boolean;
  heightClassName?: string;
  pinColor?: string;
}

// Places API (New) Autocomplete Data interfaces
// Ref: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data?utm_campaign=gmp_mcp_codeassist_v1_aistudio
interface ModernPlaceLocation {
  lat: () => number;
  lng: () => number;
}

interface ModernPlaceInstance {
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: ModernPlaceLocation | null;
  fetchFields: (opts: {
    fields: string[];
  }) => Promise<{ place: ModernPlaceInstance }>;
}

interface ModernPlacePrediction {
  placeId?: string;
  text?: { text?: string };
  mainText?: { text?: string };
  secondaryText?: { text?: string };
  toPlace: () => ModernPlaceInstance;
}

interface ModernAutocompleteSuggestionItem {
  placePrediction?: ModernPlacePrediction;
}

interface ModernPlacesLibrary {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (
      req: Record<string, unknown>
    ) => Promise<{ suggestions: ModernAutocompleteSuggestionItem[] }>;
  };
}

const PickerMapCameraController: React.FC<{
  target: GmpLatLngLiteral;
  zoom: number;
  seq: number;
}> = ({ target, zoom, seq }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || seq <= 0) return;
    const runtimeMap = map as unknown as {
      panTo?: (pos: GmpLatLngLiteral) => void;
      setZoom?: (z: number) => void;
    };
    runtimeMap.panTo?.(target);
    runtimeMap.setZoom?.(zoom);
  }, [map, target, zoom, seq]);
  return null;
};

export const EdkuLocationPickerMap: React.FC<EdkuLocationPickerMapProps> = ({
  label = 'حدد الموقع بدقة داخل إدكو والقرى المجاورة',
  helperText = 'ابحث داخل مدينة إدكو والقرى المجاورة فقط، أو اضغط «موقعي الحالي GPS» لتحديد موقعك الحقيقي تلقائياً',
  lat,
  lng,
  neighborhood,
  onChange,
  onAddressResolved,
  onWaterValidationChange,
  autoLocateOnMount = false,
  heightClassName = 'h-[260px]',
  pinColor = '#FF7100',
}) => {
  const rawPlacesLib = useMapsLibrary('places');
  const placesLib = rawPlacesLib as unknown as ModernPlacesLibrary | null;
  const sessionTokenRef = useRef<unknown | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const autoLocatedRef = useRef(false);

  const [locatingGps, setLocatingGps] = useState(false);
  const [liveWatchActive, setLiveWatchActive] = useState(false);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [gpsStatusTone, setGpsStatusTone] = useState<'ok' | 'warn'>('ok');
  const [resolvedStreetText, setResolvedStreetText] = useState<string>('');
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [isWaterPin, setIsWaterPin] = useState(false);

  // Places API (New) Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [suggestions, setSuggestions] = useState<ModernPlacePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Camera pan/zoom state
  const [cameraTarget, setCameraTarget] = useState<GmpLatLngLiteral>(
    typeof lat === 'number' &&
      Number.isFinite(lat) &&
      typeof lng === 'number' &&
      Number.isFinite(lng)
      ? { lat, lng }
      : EDKU_CITY_CENTER
  );
  const [cameraZoom, setCameraZoom] = useState(16);
  const [cameraSeq, setCameraSeq] = useState(0);

  const currentPos = useMemo(() => {
    if (
      typeof lat === 'number' &&
      Number.isFinite(lat) &&
      typeof lng === 'number' &&
      Number.isFinite(lng)
    ) {
      return { lat, lng };
    }
    if (neighborhood) {
      return resolveEdkuCoordsForNeighborhood(neighborhood);
    }
    return EDKU_CITY_CENTER;
  }, [lat, lng, neighborhood]);

  const resolvedArea = useMemo(
    () =>
      neighborhood?.trim() ||
      resolveNearestEdkuNeighborhood(currentPos.lat, currentPos.lng),
    [neighborhood, currentPos.lat, currentPos.lng]
  );

  const moveCameraTo = useCallback((nextLat: number, nextLng: number, zoom = 17) => {
    setCameraTarget({ lat: nextLat, lng: nextLng });
    setCameraZoom(zoom);
    setCameraSeq((prev) => prev + 1);
  }, []);

  const clearWaterSelection = useCallback(() => {
    setIsWaterPin(false);
    onWaterValidationChange?.(false);
  }, [onWaterValidationChange]);

  const flagWaterSelection = useCallback(() => {
    setIsWaterPin(true);
    onWaterValidationChange?.(true);
    setGpsStatusTone('warn');
    setGpsStatusMsg(
      'من فضلك اختر موقعاً على الأرض داخل إدكو (لا يمكن تثبيت الموقع فوق مياه البحر المتوسط أو بحيرة إدكو).'
    );
  }, [onWaterValidationChange]);

  const emitCoordinates = useCallback(
    (
      nextLat: number,
      nextLng: number,
      explicitNeighborhood?: string,
      explicitAddress?: string
    ) => {
      const cleanLat = Number(nextLat.toFixed(6));
      const cleanLng = Number(nextLng.toFixed(6));
      const area =
        explicitNeighborhood ||
        resolveNearestEdkuNeighborhood(cleanLat, cleanLng);
      onChange({
        lat: cleanLat,
        lng: cleanLng,
        neighborhood: area,
        ...(explicitAddress ? { resolvedAddress: explicitAddress } : {}),
      });
    },
    [onChange]
  );

  const resolveAndEmitStreetAddress = useCallback(
    async (targetLat: number, targetLng: number, explicitNeighborhood?: string) => {
      if (isEdkuWaterCoordinate(targetLat, targetLng)) {
        flagWaterSelection();
        return;
      }
      setResolvingAddress(true);
      try {
        const res = await reverseGeocodeCoordinates(targetLat, targetLng);
        if (res.isWaterBody) {
          flagWaterSelection();
          return;
        }
        clearWaterSelection();
        const bestText = (res.shortAddress || res.formattedAddress || '').trim();
        if (res.ok && bestText) {
          setResolvedStreetText(bestText);
          emitCoordinates(
            targetLat,
            targetLng,
            explicitNeighborhood || res.matchedNeighborhood,
            bestText
          );
          onAddressResolved?.(bestText);
        }
      } finally {
        setResolvingAddress(false);
      }
    },
    [clearWaterSelection, emitCoordinates, flagWaterSelection, onAddressResolved]
  );

  const localVillageSuggestions = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];
    const normalized = trimmed.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
    return EDKU_NEIGHBORHOODS.filter((area) => {
      const normArea = area.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
      return normArea.includes(normalized) || normalized.includes(normArea);
    }).slice(0, 5);
  }, [searchQuery]);

  // Debounced Places API (New) Autocomplete suggestions strictly restricted to Markaz Edku & neighboring villages
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!placesLib || !placesLib.AutocompleteSuggestion || trimmed.length < 2) {
      setSuggestions([]);
      setSearchingPlaces(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current && placesLib.AutocompleteSessionToken) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        setSearchingPlaces(true);
        const response =
          await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: trimmed,
            sessionToken: sessionTokenRef.current,
            language: 'ar',
            region: 'eg',
            includedRegionCodes: ['eg'],
            locationRestriction: { ...EDKU_SERVICE_BOUNDS },
          });

        const preds = (response.suggestions || [])
          .map((s) => s.placePrediction)
          .filter((p): p is ModernPlacePrediction => {
            if (!p) return false;
            const fullLabel = `${p.mainText?.text || ''} ${p.secondaryText?.text || ''} ${p.text?.text || ''}`;
            return !OUTSIDE_EDKU_GOVERNORATE_PATTERN.test(fullLabel);
          });
        setSuggestions(preds.slice(0, 6));
        setShowSuggestions(true);
      } catch (err) {
        checkAndEmitGmpQuotaError(err);
        setSuggestions([]);
      } finally {
        setSearchingPlaces(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [placesLib, searchQuery]);

  const handleSelectLocalAreaSuggestion = useCallback(
    (area: string) => {
      const coords = resolveEdkuCoordsForNeighborhood(area);
      clearWaterSelection();
      setSearchQuery(area);
      setSuggestions([]);
      setShowSuggestions(false);
      setGpsStatusTone('ok');
      setGpsStatusMsg(`تم الانتقال إلى «${area}» داخل نطاق إدكو والقرى المجاورة.`);
      moveCameraTo(coords.lat, coords.lng, 16);
      emitCoordinates(coords.lat, coords.lng, area);
      void resolveAndEmitStreetAddress(coords.lat, coords.lng, area);
    },
    [clearWaterSelection, emitCoordinates, moveCameraTo, resolveAndEmitStreetAddress]
  );

  const handleSelectPlacePrediction = async (prediction: ModernPlacePrediction) => {
    try {
      setSearchingPlaces(true);
      setShowSuggestions(false);
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      // Reset session token after fetchFields per Places API (New) billing best practice
      sessionTokenRef.current = null;
      setSuggestions([]);

      const loc = place.location;
      if (!loc) return;
      const rawLat = loc.lat();
      const rawLng = loc.lng();
      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return;

      const withinEdku = isWithinEdkuServiceBounds(rawLat, rawLng);
      const finalCoords = withinEdku
        ? { lat: rawLat, lng: rawLng }
        : clampToEdkuServiceBounds(rawLat, rawLng);

      if (isEdkuWaterCoordinate(finalCoords.lat, finalCoords.lng)) {
        flagWaterSelection();
        return;
      }
      clearWaterSelection();

      const display = (place.displayName || '').trim();
      const formatted = (place.formattedAddress || '').trim();
      const combinedLabel =
        display && formatted && !formatted.includes(display)
          ? `${display} — ${formatted}`
          : formatted || display || (prediction.text?.text ?? '').trim();

      setSearchQuery(display || combinedLabel);
      if (withinEdku) {
        setResolvedStreetText(combinedLabel);
        setGpsStatusTone('ok');
        setGpsStatusMsg(`تم الانتقال إلى «${display || combinedLabel}» وتثبيت الدبوس بدقة.`);
      } else {
        setGpsStatusTone('warn');
        setGpsStatusMsg(
          'البحث والتوصيل متاح داخل مدينة إدكو والقرى المجاورة فقط — تم تثبيت الدبوس داخل حدود إدكو.'
        );
      }

      moveCameraTo(finalCoords.lat, finalCoords.lng, 17);
      emitCoordinates(
        finalCoords.lat,
        finalCoords.lng,
        undefined,
        withinEdku ? combinedLabel : undefined
      );
      if (withinEdku && combinedLabel) {
        onAddressResolved?.(combinedLabel);
      } else {
        void resolveAndEmitStreetAddress(finalCoords.lat, finalCoords.lng);
      }
    } catch (err) {
      checkAndEmitGmpQuotaError(err);
      setGpsStatusTone('warn');
      setGpsStatusMsg('تعذر جلب إحداثيات هذا المكان، جرب الضغط عليه مباشرة في خريطة إدكو.');
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      const latLng = ev.detail?.latLng;
      if (!latLng) return;
      setShowSuggestions(false);
      const withinEdku = isWithinEdkuServiceBounds(latLng.lat, latLng.lng);
      const finalCoords = withinEdku
        ? { lat: latLng.lat, lng: latLng.lng }
        : clampToEdkuServiceBounds(latLng.lat, latLng.lng);
      if (isEdkuWaterCoordinate(finalCoords.lat, finalCoords.lng)) {
        flagWaterSelection();
        return;
      }
      clearWaterSelection();
      if (withinEdku) {
        setGpsStatusMsg(null);
      } else {
        setGpsStatusTone('warn');
        setGpsStatusMsg(
          'نطاق الخدمة متاح داخل مدينة إدكو والقرى المجاورة فقط — تم ضبط الدبوس داخل حدود إدكو.'
        );
      }
      emitCoordinates(finalCoords.lat, finalCoords.lng);
      void resolveAndEmitStreetAddress(finalCoords.lat, finalCoords.lng);
    },
    [clearWaterSelection, emitCoordinates, flagWaterSelection, resolveAndEmitStreetAddress]
  );

  const applyBrowserGpsFix = useCallback(
    (pos: GeolocationPosition, isInitialOrManual: boolean) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 0);
      if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return;

      if (!isWithinEdkuServiceBounds(rawLat, rawLng)) {
        setGpsAccuracyMeters(accuracy > 0 ? accuracy : null);
        setGpsStatusTone('warn');
        setGpsStatusMsg(
          'موقع جهازك الحالي خارج مدينة إدكو والقرى المجاورة — يرجى اختيار موقع التسليم داخل إدكو أو قراها من البحث أو الخريطة.'
        );
        moveCameraTo(currentPos.lat, currentPos.lng, 15);
        return;
      }

      if (isEdkuWaterCoordinate(rawLat, rawLng)) {
        flagWaterSelection();
        return;
      }
      clearWaterSelection();

      setGpsAccuracyMeters(accuracy > 0 ? accuracy : null);
      setGpsStatusTone('ok');
      setGpsStatusMsg(
        accuracy > 0
          ? `تم تحديد موقعك الحقيقي داخل إدكو عبر GPS (دقة ±${accuracy} متر).`
          : 'تم تحديد موقعك الحقيقي داخل إدكو عبر GPS بنجاح.'
      );

      moveCameraTo(rawLat, rawLng, 17);
      emitCoordinates(rawLat, rawLng);
      if (isInitialOrManual) {
        void resolveAndEmitStreetAddress(rawLat, rawLng);
      }
    },
    [
      clearWaterSelection,
      currentPos.lat,
      currentPos.lng,
      emitCoordinates,
      flagWaterSelection,
      moveCameraTo,
      resolveAndEmitStreetAddress,
    ]
  );

  const handleDetectCurrentGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusTone('warn');
      setGpsStatusMsg(
        'متصفح الجهاز لا يدعم خدمة تحديد الموقع الجغرافي (GPS)، ابحث باسم المكان بالأعلى أو اضغط على الخريطة.'
      );
      return;
    }

    setLocatingGps(true);
    setGpsStatusMsg(null);

    // Stage 1: High-accuracy hardware GPS fix
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingGps(false);
        applyBrowserGpsFix(pos, true);
      },
      (highAccErr) => {
        if (highAccErr.code === 1) {
          setLocatingGps(false);
          setGpsStatusTone('warn');
          setGpsStatusMsg(
            'تم رفض إذن الموقع من المتصفح — يرجى السماح بالوصول للموقع (Location Allow) من شريط العنوان ثم الضغط مرة أخرى.'
          );
          return;
        }
        // Stage 2: Automatic Wi-Fi / cell-tower fallback when indoor GPS times out
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            setLocatingGps(false);
            applyBrowserGpsFix(fallbackPos, true);
          },
          (fallbackErr) => {
            setLocatingGps(false);
            setGpsStatusTone('warn');
            setGpsStatusMsg(
              fallbackErr.code === 1
                ? 'تم رفض إذن الموقع من المتصفح — يرجى تفعيل صلاحية الموقع للمتصفح.'
                : 'تعذر التقاط إشارة GPS حالياً — يمكنك البحث باسم الشارع في خانة البحث بالأعلى أو الضغط على الخريطة.'
            );
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  }, [applyBrowserGpsFix]);

  const toggleLiveGpsWatch = useCallback(() => {
    if (liveWatchActive) {
      if (
        watchIdRef.current !== null &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      setLiveWatchActive(false);
      setGpsStatusMsg('تم إيقاف التتبع التلقائي المستمر وتثبيت آخر موقع محدد.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatusTone('warn');
      setGpsStatusMsg('المتصفح الحالي لا يدعم التتبع الحي للموقع.');
      return;
    }

    setLiveWatchActive(true);
    let resolvedFirstWatch = false;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const shouldGeocode = !resolvedFirstWatch;
        resolvedFirstWatch = true;
        applyBrowserGpsFix(pos, shouldGeocode);
      },
      (err) => {
        if (err.code === 1) {
          setLiveWatchActive(false);
          setGpsStatusTone('warn');
          setGpsStatusMsg('يرجى السماح للمتصفح بصلاحية الوصول للموقع لتفعيل التتبع الحي.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  }, [applyBrowserGpsFix, liveWatchActive]);

  // Cleanup live watch on unmount
  useEffect(() => {
    return () => {
      if (
        watchIdRef.current !== null &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Automatic real GPS detection on mount when requested and no coordinates are saved yet
  useEffect(() => {
    if (!autoLocateOnMount || autoLocatedRef.current) return;
    const hasExplicitCoords =
      typeof lat === 'number' &&
      Number.isFinite(lat) &&
      typeof lng === 'number' &&
      Number.isFinite(lng);
    if (!hasExplicitCoords) {
      autoLocatedRef.current = true;
      handleDetectCurrentGps();
    }
  }, [autoLocateOnMount, handleDetectCurrentGps, lat, lng]);

  return (
    <div className="rounded-2xl border border-[#334155] bg-[#1E293B] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-[#FF7100] shrink-0" />
          <span className="text-sm font-bold text-[#F8FAFC] truncate">
            {label}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDetectCurrentGps}
            disabled={locatingGps}
            className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FF7100] hover:bg-[#E66600] disabled:opacity-60 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {locatingGps ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LocateFixed className="w-4 h-4" />
            )}
            <span>
              {locatingGps ? 'جارٍ تحديد الموقع...' : 'استخدم موقعي الحالي GPS'}
            </span>
          </button>

          {HAS_MAPS_API_KEY && (
            <button
              type="button"
              onClick={toggleLiveGpsWatch}
              className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-colors cursor-pointer ${
                liveWatchActive
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-[#10192D] text-[#F8FAFC] border-[#334155] hover:border-[#FF7100]'
              }`}
              title="تتبع موقعك الحي تلقائياً أثناء الحركة"
            >
              <Radio className={`w-3.5 h-3.5 ${liveWatchActive ? 'animate-pulse' : ''}`} />
              <span>{liveWatchActive ? 'تتبع حي نشط' : 'تتبع حي'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Maps Places API (New) Search Box — only when real Maps key is configured */}
      {HAS_MAPS_API_KEY && (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#94A3B8] absolute right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => {
                if (suggestions.length > 0 || localVillageSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="ابحث داخل إدكو والقرى المجاورة..."
              className="w-full rounded-2xl border border-[#334155] bg-[#10192D] pr-10 pl-9 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#FF7100]"
            />
            {searchingPlaces && (
              <Loader2 className="w-4 h-4 text-[#FF7100] animate-spin absolute left-3" />
            )}
            {!searchingPlaces && searchQuery.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                }}
                className="absolute left-3 p-1 text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
                aria-label="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showSuggestions &&
            (localVillageSuggestions.length > 0 || suggestions.length > 0) && (
              <div className="mt-1.5 rounded-2xl border border-[#334155] bg-[#10192D] shadow-xl max-h-56 overflow-y-auto divide-y divide-[#334155] z-20 relative">
                {localVillageSuggestions.map((area) => (
                  <button
                    key={`local-${area}`}
                    type="button"
                    onClick={() => handleSelectLocalAreaSuggestion(area)}
                    className="w-full text-right px-4 py-2.5 hover:bg-[#1E293B] transition-colors flex items-start gap-2 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-[#FF7100] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#F8FAFC] truncate">
                        {area}
                      </p>
                    </div>
                  </button>
                ))}
                {suggestions.map((pred, idx) => {
                  const main =
                    pred.mainText?.text || pred.text?.text || 'موقع داخل إدكو';
                  const secondary = pred.secondaryText?.text || 'مركز إدكو، البحيرة';
                  return (
                    <button
                      key={pred.placeId || `${main}-${idx}`}
                      type="button"
                      onClick={() => void handleSelectPlacePrediction(pred)}
                      className="w-full text-right px-4 py-2.5 hover:bg-[#1E293B] transition-colors flex items-start gap-2 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-[#FF7100] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#F8FAFC] truncate">
                          {main}
                        </p>
                        {secondary && (
                          <p className="text-[11px] text-[#94A3B8] truncate">
                            {secondary}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Clean Area Selector (Replaces noisy random street chips) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-[#94A3B8]">
          المنطقة / الحي في إدكو
        </label>
        <select
          value={resolvedArea}
          onChange={(e) => {
            const area = e.target.value;
            const coords = resolveEdkuCoordsForNeighborhood(area);
            clearWaterSelection();
            setGpsStatusMsg(null);
            moveCameraTo(coords.lat, coords.lng, 16);
            emitCoordinates(coords.lat, coords.lng, area);
            void resolveAndEmitStreetAddress(coords.lat, coords.lng, area);
          }}
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl border border-[#334155] bg-[#10192D] text-sm font-semibold text-[#F8FAFC]"
        >
          {EDKU_NEIGHBORHOODS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </div>

      {isWaterPin && (
        <div
          role="alert"
          className="px-4 py-2.5 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>
            من فضلك اختر موقعاً على الأرض داخل إدكو بعيداً عن المسطحات المائية.
          </span>
        </div>
      )}

      {HAS_MAPS_API_KEY && (
        <div className={`${heightClassName} w-full rounded-2xl overflow-hidden border border-[#334155] relative`}>
          <Map
            className="w-full h-full"
            mapId="DEMO_MAP_ID"
            defaultCenter={currentPos}
            defaultZoom={16}
            minZoom={12}
            restriction={EDKU_MAP_RESTRICTION}
            gestureHandling="greedy"
            onClick={handleMapClick}
            internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
          >
            <PickerMapCameraController
              target={cameraTarget}
              zoom={cameraZoom}
              seq={cameraSeq}
            />
            <AdvancedMarker
              position={currentPos}
              draggable={true}
              onDragEnd={(e) => {
                const nextLat = e.latLng?.lat();
                const nextLng = e.latLng?.lng();
                if (typeof nextLat === 'number' && typeof nextLng === 'number') {
                  const withinEdku = isWithinEdkuServiceBounds(nextLat, nextLng);
                  const finalCoords = withinEdku
                    ? { lat: nextLat, lng: nextLng }
                    : clampToEdkuServiceBounds(nextLat, nextLng);
                  if (isEdkuWaterCoordinate(finalCoords.lat, finalCoords.lng)) {
                    flagWaterSelection();
                    return;
                  }
                  clearWaterSelection();
                  setGpsStatusMsg(null);
                  emitCoordinates(finalCoords.lat, finalCoords.lng);
                  void resolveAndEmitStreetAddress(finalCoords.lat, finalCoords.lng);
                }
              }}
              title="الموقع المحدد"
            >
              <Pin
                background={isWaterPin ? '#DC2626' : pinColor}
                borderColor={isWaterPin ? '#7F1D1D' : '#1E293B'}
                glyphColor="#FFFFFF"
                scale={1.2}
              />
            </AdvancedMarker>
          </Map>
        </div>
      )}

      {(resolvingAddress || resolvedStreetText) && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-[#10192D] border border-[#334155] text-xs text-[#F8FAFC] flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-[#FF7100] shrink-0" />
          <span className="truncate">
            {resolvingAddress
              ? 'جارٍ تحديد العنوان...'
              : resolvedStreetText}
          </span>
        </div>
      )}

      {gpsStatusMsg && (
        <div
          className={`px-3.5 py-2.5 rounded-2xl border text-xs ${
            gpsStatusTone === 'ok'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
          }`}
        >
          {gpsStatusMsg}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. CUSTOMER LIVE ORDER SCOOTER TRACKING MAP
 * ========================================================================== */

interface LiveOrderScooterMapProps {
  order: OrderRecord;
  store?: StoreRecord | null;
}

export const LiveOrderScooterMap: React.FC<LiveOrderScooterMapProps> = ({
  order,
  store,
}) => {
  const storePosition = useMemo(() => {
    if (
      typeof order.storeLat === 'number' &&
      !Number.isNaN(order.storeLat) &&
      typeof order.storeLng === 'number' &&
      !Number.isNaN(order.storeLng)
    ) {
      return { lat: order.storeLat, lng: order.storeLng };
    }
    if (store && typeof store.lat === 'number' && typeof store.lng === 'number') {
      return { lat: store.lat, lng: store.lng };
    }
    return EDKU_CITY_CENTER;
  }, [order.storeLat, order.storeLng, store]);

  const customerPosition = useMemo(() => {
    if (
      typeof order.customerLat === 'number' &&
      !Number.isNaN(order.customerLat) &&
      typeof order.customerLng === 'number' &&
      !Number.isNaN(order.customerLng)
    ) {
      return { lat: order.customerLat, lng: order.customerLng };
    }
    const resolved = resolveEdkuCoordsForNeighborhood(
      order.deliveryNeighborhood
    );
    if (
      Math.abs(resolved.lat - storePosition.lat) < 0.0005 &&
      Math.abs(resolved.lng - storePosition.lng) < 0.0005
    ) {
      return {
        lat: Number((resolved.lat + 0.0038).toFixed(6)),
        lng: Number((resolved.lng - 0.0032).toFixed(6)),
      };
    }
    return resolved;
  }, [order.customerLat, order.customerLng, order.deliveryNeighborhood, storePosition]);

  const scooterPosition = useMemo(() => {
    if (
      typeof order.courierLat === 'number' &&
      !Number.isNaN(order.courierLat) &&
      typeof order.courierLng === 'number' &&
      !Number.isNaN(order.courierLng)
    ) {
      return { lat: order.courierLat, lng: order.courierLng };
    }
    return {
      lat: Number(((storePosition.lat + customerPosition.lat) / 2).toFixed(6)),
      lng: Number(((storePosition.lng + customerPosition.lng) / 2).toFixed(6)),
    };
  }, [order.courierLat, order.courierLng, storePosition, customerPosition]);

  const trackingWaypoints = useMemo(
    () => [scooterPosition, customerPosition],
    [scooterPosition, customerPosition]
  );

  if (!HAS_MAPS_API_KEY) {
    return (
      <div className="rounded-2xl p-6 bg-[#1E293B] border border-[#334155] text-center space-y-2">
        <Navigation className="w-6 h-6 text-[#FF7100] mx-auto" />
        <p className="text-sm font-bold text-[#F8FAFC]">
          المندوب في الطريق إليك الآن داخل {order.deliveryNeighborhood}
        </p>
        {order.courierLocation && (
          <p className="text-xs text-[#94A3B8]">
            آخر نقطة مسجلة: {order.courierLocation}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#334155] bg-[#1E293B]">
      <div className="px-4 py-3 border-b border-[#334155] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-[#FF7100] shrink-0" />
          <span className="text-sm font-bold text-[#F8FAFC]">
            التتبع الحي لمندوب إدكاوي على الخريطة
          </span>
        </div>
        <span className="text-xs text-[#94A3B8] tabular-nums">
          {order.courierLocation || 'يتحرك الآن باتجاه موقعك'}
        </span>
      </div>

      <div className="h-[320px] sm:h-[360px] w-full relative">
        <Map
          className="w-full h-full"
          mapId="DEMO_MAP_ID"
          defaultCenter={scooterPosition}
          defaultZoom={15}
          minZoom={12}
          restriction={EDKU_MAP_RESTRICTION}
          gestureHandling="greedy"
          internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
        >
          <SdkRoutePolylineLayer
            waypoints={trackingWaypoints}
            strokeColor="#FF7100"
          />

          <AdvancedMarker
            position={storePosition}
            title={`المتجر: ${order.storeName}`}
          >
            <div className="flex items-center gap-1.5 bg-[#1E293B] text-white px-2.5 py-1.5 rounded-xl shadow-md border border-white/20 text-xs font-bold">
              {order.orderType === 'pharmacy_prescription' ? (
                <Pill className="w-3.5 h-3.5 text-teal-400" />
              ) : (
                <Store className="w-3.5 h-3.5 text-[#FF7100]" />
              )}
              <span>{order.storeName}</span>
            </div>
          </AdvancedMarker>

          <AdvancedMarker
            position={customerPosition}
            title={`موقع التسليم: ${order.deliveryNeighborhood}`}
          >
            <Pin
              background="#16A34A"
              borderColor="#14532D"
              glyphColor="#FFFFFF"
              scale={1.1}
            />
          </AdvancedMarker>

          <AdvancedMarker
            position={scooterPosition}
            zIndex={60}
            title={
              order.courierName
                ? `المندوب: ${order.courierName}`
                : 'مندوب إدكاوي'
            }
          >
            <div className="flex items-center gap-1.5 bg-[#FF7100] text-white px-3 py-1.5 rounded-full shadow-lg border-2 border-white text-xs font-bold">
              <Bike className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">
                {order.courierName || 'مندوب إدكاوي'}
              </span>
            </div>
          </AdvancedMarker>
        </Map>
      </div>

      <div className="px-4 py-3 bg-[#10192D] border-t border-[#334155] flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8] tabular-nums">
        <span>نقطة الاستلام: {order.storeName}</span>
        <span>·</span>
        <span>الوجهة: {order.deliveryNeighborhood}</span>
        <span>·</span>
        <span>
          إحداثيات المندوب: {scooterPosition.lat.toFixed(4)},{' '}
          {scooterPosition.lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. COURIER MULTI-STOP ROUTE + DEMAND HEATMAP MAP
 * ========================================================================== */

interface CourierMultiStopAndHeatmapMapProps {
  courierCoords: { lat: number; lng: number };
  courierName: string;
  activeDeliveries: OrderRecord[];
  allPoolOrders: OrderRecord[];
}

export const CourierMultiStopAndHeatmapMap: React.FC<
  CourierMultiStopAndHeatmapMapProps
> = ({ courierCoords, courierName, activeDeliveries, allPoolOrders }) => {
  const [showHeatmap, setShowHeatmap] = useState(true);

  const stops = useMemo(() => {
    const storeStops: Array<{
      id: string;
      label: string;
      pos: { lat: number; lng: number };
    }> = [];
    const customerStops: Array<{
      id: string;
      label: string;
      pos: { lat: number; lng: number };
    }> = [];

    activeDeliveries.forEach((ord, idx) => {
      const sPos =
        typeof ord.storeLat === 'number' && typeof ord.storeLng === 'number'
          ? { lat: ord.storeLat, lng: ord.storeLng }
          : EDKU_CITY_CENTER;
      const cPos =
        typeof ord.customerLat === 'number' &&
        typeof ord.customerLng === 'number'
          ? { lat: ord.customerLat, lng: ord.customerLng }
          : resolveEdkuCoordsForNeighborhood(ord.deliveryNeighborhood);

      storeStops.push({
        id: `store_${ord.id}_${idx}`,
        label: ord.storeName,
        pos: sPos,
      });
      customerStops.push({
        id: `cust_${ord.id}_${idx}`,
        label: `${ord.customerName || 'عميل'} (${ord.deliveryNeighborhood})`,
        pos: cPos,
      });
    });

    const routeWaypoints = [
      courierCoords,
      ...storeStops.map((s) => s.pos),
      ...customerStops.map((c) => c.pos),
    ];

    return { storeStops, customerStops, routeWaypoints };
  }, [courierCoords, activeDeliveries]);

  const thermalZones = useMemo<ThermalZoneItem[]>(() => {
    const countsByArea: Record<string, number> = {};
    for (const ord of [...allPoolOrders, ...activeDeliveries]) {
      const area = ord.deliveryNeighborhood?.trim() || 'وسط البلد - السوق';
      countsByArea[area] = (countsByArea[area] ?? 0) + 1;
    }
    const maxCount = Math.max(1, ...Object.values(countsByArea));

    return Object.entries(EDKU_NEIGHBORHOOD_COORDS).map(([area, center]) => {
      const count = countsByArea[area] ?? 0;
      const intensity =
        count > 0 ? Math.min(1, 0.35 + (count / maxCount) * 0.65) : 0.22;
      return {
        neighborhood: area,
        center,
        count,
        intensity,
      };
    });
  }, [allPoolOrders, activeDeliveries]);

  if (!HAS_MAPS_API_KEY) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-[#1E293B] border border-[#334155] overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[#334155] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-[#FF7100] shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-[#F8FAFC]">
              خريطة المسار المتعدد والمناطق الساخنة (إدكو)
            </h3>
            <p className="text-[11px] text-[#94A3B8]">
              مسار التوصيل المجمع ({activeDeliveries.length} طلب نشط) مع مؤشر كثافة الطلبات بالأحياء
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowHeatmap((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
            showHeatmap
              ? 'bg-[#FF7100] text-white'
              : 'bg-[#10192D] border border-[#334155] text-[#F8FAFC]'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{showHeatmap ? 'إخفاء المناطق الساخنة' : 'إظهار المناطق الساخنة'}</span>
        </button>
      </div>

      <div className="h-[340px] w-full relative">
        <Map
          className="w-full h-full"
          mapId="DEMO_MAP_ID"
          defaultCenter={courierCoords}
          defaultZoom={14}
          minZoom={12}
          restriction={EDKU_MAP_RESTRICTION}
          gestureHandling="greedy"
          internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
        >
          <DemandThermalCirclesLayer
            zones={thermalZones}
            enabled={showHeatmap}
          />

          {stops.routeWaypoints.length >= 2 && (
            <SdkRoutePolylineLayer
              waypoints={stops.routeWaypoints}
              strokeColor="#FF7100"
              fitBounds={true}
            />
          )}

          {/* Courier Marker */}
          <AdvancedMarker position={courierCoords} zIndex={70} title={courierName}>
            <div className="flex items-center gap-1.5 bg-[#FF7100] text-white px-3 py-1.5 rounded-full shadow-lg border-2 border-white text-xs font-bold">
              <Bike className="w-4 h-4" />
              <span>{courierName || 'موقعي'}</span>
            </div>
          </AdvancedMarker>

          {/* Store Pickup Stops */}
          {stops.storeStops.map((s, idx) => (
            <AdvancedMarker
              key={s.id}
              position={s.pos}
              title={`استلام #${idx + 1}: ${s.label}`}
            >
              <Pin
                background="#1E293B"
                borderColor="#FF7100"
                glyphColor="#FFFFFF"
                glyph={String(idx + 1)}
              />
            </AdvancedMarker>
          ))}

          {/* Customer Dropoff Stops */}
          {stops.customerStops.map((c, idx) => (
            <AdvancedMarker
              key={c.id}
              position={c.pos}
              title={`تسليم #${idx + 1}: ${c.label}`}
            >
              <Pin
                background="#16A34A"
                borderColor="#14532D"
                glyphColor="#FFFFFF"
                glyph={String(idx + 1)}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </div>

      <div className="px-4 py-2.5 edkawi-surface-muted flex flex-wrap items-center justify-between gap-2 text-xs text-[#94A3B8]">
        <span>برتقالي: موقعك ومسار الحركة</span>
        <span>·</span>
        <span>كحلي: نقاط استلام المتاجر</span>
        <span>·</span>
        <span>أخضر: نقاط تسليم العملاء</span>
      </div>
    </section>
  );
};

/* ============================================================================
 * 5. ADMIN LIVE FLEET & STORES MAP
 * ========================================================================== */

interface AdminLiveCouriersMapProps {
  couriers: CourierRecord[];
  stores: StoreRecord[];
}

export const AdminLiveCouriersMap: React.FC<AdminLiveCouriersMapProps> = ({
  couriers,
  stores,
}) => {
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
    null
  );

  const approvedCouriers = useMemo(
    () =>
      couriers
        .filter((c) => c.approvalStatus === 'approved')
        .map((c) => {
          const fallback = resolveEdkuCoordsForNeighborhood(c.neighborhood);
          return {
            courier: c,
            position: {
              lat: typeof c.lat === 'number' ? c.lat : fallback.lat,
              lng: typeof c.lng === 'number' ? c.lng : fallback.lng,
            },
          };
        }),
    [couriers]
  );

  const selectedCourierEntry = useMemo(
    () =>
      approvedCouriers.find((e) => e.courier.id === selectedCourierId) ?? null,
    [approvedCouriers, selectedCourierId]
  );

  if (!HAS_MAPS_API_KEY) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-[#1E293B] border border-[#334155] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#334155] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-[#FF7100]" />
          <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
            خريطة المتابعة الحية لأسطول المناديب والمتاجر في إدكو
          </h3>
        </div>
        <span className="text-xs text-[#94A3B8] tabular-nums">
          {approvedCouriers.filter((c) => c.courier.isAvailable).length} مندوب متصل ·{' '}
          {stores.filter((s) => s.isActive).length} متجر نشط
        </span>
      </div>

      <div className="h-[360px] w-full relative">
        <Map
          className="w-full h-full"
          mapId="DEMO_MAP_ID"
          defaultCenter={EDKU_CITY_CENTER}
          defaultZoom={14}
          minZoom={12}
          restriction={EDKU_MAP_RESTRICTION}
          gestureHandling="greedy"
          internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
        >
          {stores
            .filter((s) => s.isActive)
            .map((s) => {
              const fallback = resolveEdkuCoordsForNeighborhood(s.neighborhood);
              const pos = {
                lat: typeof s.lat === 'number' ? s.lat : fallback.lat,
                lng: typeof s.lng === 'number' ? s.lng : fallback.lng,
              };
              return (
                <AdvancedMarker key={s.id} position={pos} title={s.name}>
                  <Pin
                    background={s.category === 'صيدليات' ? '#0D9488' : '#1E293B'}
                    borderColor="#FFFFFF"
                    glyphColor="#FFFFFF"
                    scale={0.95}
                  />
                </AdvancedMarker>
              );
            })}

          {approvedCouriers.map(({ courier, position }) => (
            <AdvancedMarker
              key={courier.id}
              position={position}
              zIndex={50}
              title={courier.name}
              onClick={() => setSelectedCourierId(courier.id)}
            >
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-md border border-white cursor-pointer ${
                  courier.isAvailable
                    ? 'bg-[#FF7100] text-white'
                    : 'bg-slate-600 text-slate-100'
                }`}
              >
                <Bike className="w-3.5 h-3.5" />
                <span>{courier.name.slice(0, 14)}</span>
              </div>
            </AdvancedMarker>
          ))}

          {selectedCourierEntry && (
            <InfoWindow
              position={selectedCourierEntry.position}
              onCloseClick={() => setSelectedCourierId(null)}
            >
              <div
                dir="rtl"
                className="min-w-[190px] p-1 text-right font-sans text-slate-900 space-y-1 keep-light-surface"
              >
                <div className="text-sm font-bold text-slate-900">
                  {selectedCourierEntry.courier.name}
                </div>
                <div className="text-xs text-slate-600">
                  {selectedCourierEntry.courier.vehicleType} ·{' '}
                  {selectedCourierEntry.courier.neighborhood}
                </div>
                <div className="text-xs text-slate-600 tabular-nums">
                  توصيلات مكتملة:{' '}
                  {selectedCourierEntry.courier.completedDeliveries} · الحالة:{' '}
                  {selectedCourierEntry.courier.isAvailable ? 'متاح' : 'غير متاح'}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </section>
  );
};
