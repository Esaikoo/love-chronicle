import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bed, Bike, Bus, CalendarDays, Camera, Car, Coffee, Crosshair, Download, FileSpreadsheet, FileUp, Flag, Gift, Heart, Home, KeyRound, MapPinned, Plane, Plus, RotateCcw, Route, Save, Sparkles, Train, Trash2, Utensils } from "lucide-react";
import { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState, WheelEvent as ReactWheelEvent } from "react";
import { absoluteUrl, api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { CountdownItem, TravelDay, TravelLeg, TravelPlan, TravelStop, TravelStopType, TravelTransport } from "../types";
import ImageLightbox from "./ImageLightbox";
import ImageStackCarousel from "./ImageStackCarousel";
import Modal from "./Modal";

type TravelPlanWorkspaceProps = {
  countdown: CountdownItem;
  onClose: () => void;
};

type MapKeySettings = {
  amapJsKey: string;
  hasWebServiceKey: boolean;
};

function TravelEditField({ label, hint, unit, className = "", children }: { label: string; hint?: string; unit?: string; className?: string; children: ReactNode }) {
  return (
    <label className={`travel-edit-field ${className}`}>
      <span>
        <b>{label}</b>
        {unit && <em>{unit}</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

const dayColors = ["#e11d8a", "#7c3aed", "#f97316", "#db2777", "#0f766e", "#d97706", "#dc2626", "#2563eb", "#9333ea", "#f43f5e", "#0891b2", "#65a30d"];
const daySoftColors = ["#ffe1f0", "#eadcff", "#ffe0d4", "#ffd8ea", "#d7fbf6", "#fff0c2", "#ffe4e6", "#dbeafe", "#f3e8ff", "#ffe4ed", "#cffafe", "#ecfccb"];

const stopTypeLabels: Record<TravelStopType, string> = {
  start: "出发点",
  end: "终点",
  scenic: "景点",
  restaurant: "餐厅",
  hotel: "酒店",
  station: "车站",
  airport: "机场",
  shopping: "购物",
  rest: "休息",
  other: "其他"
};

const transportLabels: Record<TravelTransport, string> = {
  walk: "步行",
  bike: "骑行",
  drive: "驾车",
  taxi: "打车",
  bus: "公交",
  subway: "地铁",
  train: "火车",
  flight: "飞机",
  other: "其他"
};

const stopIcons: Record<TravelStopType, typeof Heart> = {
  start: Home,
  end: Flag,
  scenic: Camera,
  restaurant: Utensils,
  hotel: Bed,
  station: Train,
  airport: Plane,
  shopping: Gift,
  rest: Coffee,
  other: Heart
};

const stopMarkerEmojis: Record<TravelStopType, string> = {
  start: "🏠",
  end: "⭐",
  scenic: "📷",
  restaurant: "🍰",
  hotel: "🌙",
  station: "🚆",
  airport: "✈️",
  shopping: "🎁",
  rest: "☕",
  other: "💗"
};

const transportIcons: Record<TravelTransport, typeof Route> = {
  walk: Heart,
  bike: Bike,
  drive: Car,
  taxi: Car,
  bus: Bus,
  subway: Train,
  train: Train,
  flight: Plane,
  other: Route
};

const MAP_DRAG_SENSITIVITY = 0.035;
const MAP_WHEEL_STEP = 0.095;

function legTransports(leg: Pick<TravelLeg, "transport" | "transports">): TravelTransport[] {
  const values = (leg.transports?.length ? leg.transports : [leg.transport]).filter(Boolean) as TravelTransport[];
  return values.length ? Array.from(new Set(values)) : ["other"];
}

function primaryTransport(leg: Pick<TravelLeg, "transport" | "transports">) {
  return legTransports(leg)[0] || "other";
}

function transportText(leg: Pick<TravelLeg, "transport" | "transports">) {
  return legTransports(leg).map((item) => transportLabels[item]).join(" + ");
}

function emptyPlan(countdown: CountdownItem): TravelPlan {
  const startDate = countdown.targetDate || dayjs().format("YYYY-MM-DD");
  return {
    title: `${countdown.title || "给她的"}旅行攻略`,
    destination: "",
    startDate,
    endDate: startDate,
    intro: countdown.description,
    defaultMapMode: "2D",
    days: [
      {
        dayNumber: 1,
        date: startDate,
        title: "Day 1",
        summary: "把第一天的期待写在这里",
        themeColor: dayColors[0],
        stops: [],
        legs: []
      }
    ]
  };
}

function formatMoney(value?: number) {
  return value ? `¥${value}` : "¥0";
}

function totalCost(plan: TravelPlan | null) {
  if (!plan) return 0;
  return plan.days.reduce((sum, day) => sum + day.stops.reduce((stopSum, stop) => stopSum + (Number(stop.cost) || 0), 0) + day.legs.reduce((legSum, leg) => legSum + (Number(leg.plannedCost) || 0), 0), 0);
}

function totalMinutes(plan: TravelPlan | null) {
  if (!plan) return 0;
  return plan.days.reduce((sum, day) => sum + day.legs.reduce((legSum, leg) => legSum + (Number(leg.plannedMinutes) || Number(leg.mapMinutes) || 0), 0), 0);
}

function stopCount(plan: TravelPlan | null) {
  return plan?.days.reduce((sum, day) => sum + day.stops.length, 0) ?? 0;
}

function dayRange(plan: TravelPlan | null) {
  if (!plan) return "";
  return `${plan.startDate} 至 ${plan.endDate}`;
}

function normalizeUrl(url?: string) {
  if (!url) return "";
  return url.startsWith("/uploads") ? absoluteUrl(url) : url;
}

function isVideoAsset(url?: string) {
  return Boolean(url && /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url));
}

function stopImages(stop?: TravelStop | null) {
  if (!stop) return [];
  const urls = [...(stop.imageUrls || [])];
  if (stop.imageUrl && !urls.includes(stop.imageUrl)) urls.unshift(stop.imageUrl);
  return urls.filter(Boolean);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function arcPath(origin: [number, number], destination: [number, number], lift = 0.08) {
  const [x1, y1] = origin;
  const [x2, y2] = destination;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / distance;
  const ny = dx / distance;
  const curve = Math.min(0.18, distance * lift);
  return Array.from({ length: 22 }, (_, index) => {
    const t = index / 21;
    const wave = Math.sin(Math.PI * t) * curve;
    return [x1 + dx * t + nx * wave, y1 + dy * t + ny * wave];
  });
}

function midpoint(path: any[]) {
  if (!path.length) return undefined;
  return path[Math.floor(path.length / 2)];
}

function routeLabel(leg: TravelLeg) {
  const minutes = leg.plannedMinutes || leg.mapMinutes;
  const cost = leg.plannedCost ? ` · ¥${leg.plannedCost}` : "";
  return `${transportText(leg)}${minutes ? ` · ${minutes}分钟` : ""}${cost}`;
}

function stopDomKey(stop: Pick<TravelStop, "id" | "dayNumber" | "order" | "name">) {
  return stop.id || `${stop.dayNumber}-${stop.order}-${stop.name}`;
}

function enableMapInteraction(map: any) {
  if (typeof map.setStatus === "function") {
    map.setStatus({
      dragEnable: true,
      zoomEnable: true,
      scrollWheel: true,
      touchZoom: true,
      doubleClickZoom: true,
      keyboardEnable: true,
    });
  }
  if (typeof map.setDefaultCursor === "function") {
    map.setDefaultCursor("grab");
  }
}

function overlapOffset(index: number, total: number) {
  if (total <= 1) return { x: 0, y: 0 };
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const radius = Math.min(38, 18 + total * 4);
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

function getOrderedDayLegs(day: TravelDay): TravelLeg[] {
  const sortedStops = [...day.stops].sort((a, b) => a.order - b.order);
  if (sortedStops.length < 2) return day.legs;
  const legByPair = new Map(day.legs.map((leg) => [`${leg.fromOrder}-${leg.toOrder}`, leg]));
  return sortedStops.slice(0, -1).map((stop, index) => {
    const nextStop = sortedStops[index + 1];
    return legByPair.get(`${stop.order}-${nextStop.order}`) || {
      dayNumber: day.dayNumber,
      fromOrder: stop.order,
      toOrder: nextStop.order,
      transport: "other",
      transports: ["other"],
      useMapRoute: true
    };
  });
}

function CustomSelect<T extends string>({ value, options, iconFor, onChange, ariaLabel }: { value: T; options: Array<{ value: T; label: string }>; iconFor: (value: T) => typeof Heart; onChange: (value: T) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];
  const SelectedIcon = iconFor(selected.value);
  return (
    <div className={open ? "pretty-select custom-select open" : "pretty-select custom-select"} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button type="button" className="custom-select-button" aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <SelectedIcon size={16} />
        <span>{selected.label}</span>
      </button>
      {open && (
        <div className="custom-select-menu">
          {options.map((option) => {
            const OptionIcon = iconFor(option.value);
            return (
              <button className={option.value === value ? "active" : ""} type="button" key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}>
                <OptionIcon size={15} />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TypeSelect({ value, onChange }: { value: TravelStopType; onChange: (value: TravelStopType) => void }) {
  return (
    <CustomSelect
      value={value}
      options={(Object.entries(stopTypeLabels) as Array<[TravelStopType, string]>).map(([optionValue, label]) => ({ value: optionValue, label }))}
      iconFor={(optionValue) => stopIcons[optionValue] || Heart}
      onChange={onChange}
      ariaLabel="选择地点类型"
    />
  );
}

function StopSelect({ value, stops, onChange }: { value: number; stops: TravelStop[]; onChange: (value: number) => void }) {
  const options = stops.map((stop) => ({ value: String(stop.order), label: `${stop.order}. ${stop.name || "未命名"}` }));
  return (
    <CustomSelect
      value={String(value)}
      options={options.length ? options : [{ value: "0", label: "暂无地点" }]}
      iconFor={() => MapPinned}
      onChange={(next) => onChange(Number(next))}
      ariaLabel="选择地点"
    />
  );
}

function TransportMultiSelect({ value, onChange }: { value: TravelTransport[]; onChange: (value: TravelTransport[]) => void }) {
  const selected: TravelTransport[] = value.length ? value : ["other"];
  const toggle = (transport: TravelTransport) => {
    const next = selected.includes(transport)
      ? selected.filter((item) => item !== transport)
      : [...selected.filter((item) => item !== "other"), transport];
    onChange(next.length ? next : ["other"]);
  };
  return (
    <div className="transport-choice-grid">
      {(Object.keys(transportLabels) as TravelTransport[]).map((transport) => {
        const Icon = transportIcons[transport] || Route;
        const active = selected.includes(transport);
        return (
          <button className={active ? "transport-choice active" : "transport-choice"} type="button" key={transport} onClick={() => toggle(transport)}>
            <Icon size={15} />
            {transportLabels[transport]}
          </button>
        );
      })}
    </div>
  );
}

function TravelMap({ plan, activeDay, selectedStop, onSelectStop, amapKey }: { plan: TravelPlan | null; activeDay: number | "all"; selectedStop?: string; onSelectStop: (stop: TravelStop) => void; amapKey?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const amapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const fitOverlaysRef = useRef<any[]>([]);
  const currentLocationMarkerRef = useRef<any>(null);
  const drawIdRef = useRef(0);
  const fitSignatureRef = useRef("");
  const dragRef = useRef<{ active: boolean; x: number; y: number; centerPixel?: any; moved: boolean }>({ active: false, x: 0, y: 0, moved: false });
  const [locating, setLocating] = useState(false);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [overlayMarkers, setOverlayMarkers] = useState<Array<{ key: string; stop: TravelStop; x: number; y: number; color: string; soft: string }>>([]);
  const key = amapKey || (import.meta.env.VITE_AMAP_JS_KEY as string | undefined);
  const visibleDays = useMemo(() => {
    if (!plan) return [];
    return activeDay === "all" ? plan.days : plan.days.filter((day) => day.dayNumber === activeDay);
  }, [activeDay, plan]);

  const refreshOverlayMarkers = useCallback(() => {
    const map = amapRef.current;
    if (!map || typeof map.lngLatToContainer !== "function") return;
    const nextMarkers: Array<{ key: string; stop: TravelStop; x: number; y: number; color: string; soft: string }> = [];
    visibleDays.forEach((day) => {
      const color = dayColors[(day.dayNumber - 1) % dayColors.length];
      const soft = daySoftColors[(day.dayNumber - 1) % daySoftColors.length];
      const closeGroups = new Map<string, TravelStop[]>();
      day.stops.forEach((stop) => {
        if (stop.longitude == null || stop.latitude == null) return;
        const groupKey = `${Math.round(stop.longitude * 1400)}:${Math.round(stop.latitude * 1400)}`;
        closeGroups.set(groupKey, [...(closeGroups.get(groupKey) || []), stop]);
      });
      day.stops.forEach((stop) => {
        if (stop.longitude == null || stop.latitude == null) return;
        const groupKey = `${Math.round(stop.longitude * 1400)}:${Math.round(stop.latitude * 1400)}`;
        const closeGroup = closeGroups.get(groupKey) || [stop];
        const offset = overlapOffset(closeGroup.findIndex((item) => item.order === stop.order), closeGroup.length);
        const pixel = map.lngLatToContainer([stop.longitude, stop.latitude]);
        nextMarkers.push({
          key: stopDomKey(stop),
          stop,
          x: Number(pixel.x ?? pixel.getX?.() ?? 0) + offset.x,
          y: Number(pixel.y ?? pixel.getY?.() ?? 0) + offset.y,
          color,
          soft
        });
      });
    });
    setOverlayMarkers(nextMarkers);
  }, [visibleDays]);

  useEffect(() => {
    return () => {
      drawIdRef.current += 1;
      if (amapRef.current) {
        try {
          overlaysRef.current.forEach((overlay) => amapRef.current.remove(overlay));
          amapRef.current.destroy();
        } catch {
          // AMap may already have detached its internal canvas during modal close.
        }
        overlaysRef.current = [];
        amapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!key || !mapRef.current || amapRef.current || !(window as any).AMap) return;
    amapRef.current = new (window as any).AMap.Map(mapRef.current, {
      viewMode: "2D",
      pitch: 0,
      zoom: 11,
      resizeEnable: true,
      dragEnable: true,
      zoomEnable: true,
      touchZoom: true,
      scrollWheel: true,
      isHotspot: false,
      mapStyle: "amap://styles/macaron"
    });
    enableMapInteraction(amapRef.current);
    setMapReadyTick((value) => value + 1);
  }, [key]);

  useEffect(() => {
    if (!key || (window as any).AMap) return;
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
    script.async = true;
    script.onload = () => {
      if (mapRef.current && !(amapRef.current)) {
        amapRef.current = new (window as any).AMap.Map(mapRef.current, { viewMode: "2D", pitch: 0, zoom: 11, resizeEnable: true, dragEnable: true, zoomEnable: true, touchZoom: true, scrollWheel: true, isHotspot: false, mapStyle: "amap://styles/macaron" });
        enableMapInteraction(amapRef.current);
        setMapReadyTick((value) => value + 1);
      }
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [key]);

  useEffect(() => {
    const map = amapRef.current;
    if (!map || typeof map.on !== "function") return;
    let frame = 0;
    const refresh = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        refreshOverlayMarkers();
      });
    };
    map.on("complete", refresh);
    map.on("zoomchange", refresh);
    map.on("zoomend", refresh);
    map.on("mapmove", refresh);
    map.on("moveend", refresh);
    const timer = window.setTimeout(refresh, 100);
    return () => {
      window.clearTimeout(timer);
      if (frame) window.cancelAnimationFrame(frame);
      map.off?.("complete", refresh);
      map.off?.("zoomchange", refresh);
      map.off?.("zoomend", refresh);
      map.off?.("mapmove", refresh);
      map.off?.("moveend", refresh);
    };
  }, [key, mapReadyTick, refreshOverlayMarkers]);

  useEffect(() => {
    if (!mapRef.current) return;
    const resize = () => {
      if (amapRef.current && typeof amapRef.current.resize === "function") {
        amapRef.current.resize();
      }
    };
    resize();
    const timer = window.setTimeout(resize, 260);
    const observer = new ResizeObserver(resize);
    observer.observe(mapRef.current);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [key, activeDay, mapReadyTick]);

  useEffect(() => {
    const map = amapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap) return;
    const drawId = drawIdRef.current + 1;
    drawIdRef.current = drawId;
    overlaysRef.current.forEach((overlay) => map.remove(overlay));
    overlaysRef.current = [];
    fitOverlaysRef.current = [];
    currentLocationMarkerRef.current = null;
    const bounds: any[] = [];
    visibleDays.forEach((day) => {
      const color = dayColors[(day.dayNumber - 1) % dayColors.length];
      day.stops.forEach((stop) => {
        if (stop.longitude == null || stop.latitude == null) return;
        const position = [stop.longitude, stop.latitude];
        const fitMarker = new AMap.Marker({
          position,
          anchor: "center",
          content: `<span class="amap-fit-marker"></span>`,
          bubble: false,
          clickable: false,
          zIndex: 1,
        });
        overlaysRef.current.push(fitMarker);
        fitOverlaysRef.current.push(fitMarker);
        map.add(fitMarker);
        bounds.push(position);
      });
      const stopsByOrder = new Map(day.stops.map((stop) => [stop.order, stop]));
      const addRouteLabel = (path: any[], leg: TravelLeg, color: string, toStop?: TravelStop) => {
        const labelPosition = toStop?.longitude != null && toStop.latitude != null ? [toStop.longitude, toStop.latitude] : midpoint(path);
        if (!labelPosition) return;
        const label = new AMap.Text({
          text: routeLabel(leg),
          position: labelPosition,
          anchor: "bottom-center",
          bubble: false,
          zIndex: 30,
          offset: new AMap.Pixel(0, -66),
          style: {
            padding: "5px 9px",
            border: "1px solid rgba(255,255,255,.9)",
            borderRadius: "999px",
            backgroundColor: "rgba(255,255,255,.88)",
            boxShadow: "0 8px 20px rgba(126,48,105,.18)",
            color,
            fontSize: "12px",
            fontWeight: "800",
            pointerEvents: "none",
            whiteSpace: "nowrap"
          }
        });
        overlaysRef.current.push(label);
        map.add(label);
      };
      const addPolyline = (path: any[], color: string, leg: TravelLeg, toStop?: TravelStop) => {
        if (path.length < 2) return;
        const halo = new AMap.Polyline({
          path,
          strokeColor: "#ffffff",
          strokeOpacity: 0.92,
          strokeWeight: primaryTransport(leg) === "walk" ? 9 : 12,
          strokeStyle: "solid",
          lineJoin: "round",
          zIndex: 8,
          bubble: false
        });
        const line = new AMap.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: 0.96,
          strokeWeight: primaryTransport(leg) === "walk" ? 5 : 7,
          strokeStyle: ["train", "flight", "other"].includes(primaryTransport(leg)) ? "dashed" : "solid",
          strokeDasharray: primaryTransport(leg) === "walk" ? [8, 8] : ["train", "flight", "other"].includes(primaryTransport(leg)) ? [14, 10] : undefined,
          lineJoin: "round",
          showDir: true,
          dirColor: "#ffffff",
          zIndex: 10,
          bubble: false
        });
        const sparkle = new AMap.Polyline({
          path,
          strokeColor: primaryTransport(leg) === "walk" ? "#6d28d9" : "#ffffff",
          strokeOpacity: 0.85,
          strokeWeight: 2,
          strokeStyle: "dashed",
          strokeDasharray: [2, 12],
          lineJoin: "round",
          zIndex: 11,
          bubble: false
        });
        overlaysRef.current.push(halo, line, sparkle);
        fitOverlaysRef.current.push(halo, line, sparkle);
        map.add(halo);
        map.add(line);
        map.add(sparkle);
        addRouteLabel(path, leg, color, toStop);
      };
      const searchRoute = (leg: TravelLeg, fromStop: TravelStop, toStop: TravelStop, color: string) => {
        const origin = [fromStop.longitude as number, fromStop.latitude as number] as [number, number];
        const destination = [toStop.longitude as number, toStop.latitude as number] as [number, number];
        const fallback = () => {
          if (drawIdRef.current !== drawId) return;
          addPolyline(arcPath(origin, destination, ["train", "flight", "other", "bus", "subway"].includes(primaryTransport(leg)) ? 0.14 : 0.06), color, leg, toStop);
        };
        const legPrimaryTransport = primaryTransport(leg);
        const pluginName = legPrimaryTransport === "walk" ? "AMap.Walking" : legPrimaryTransport === "bike" ? "AMap.Riding" : ["drive", "taxi"].includes(legPrimaryTransport) ? "AMap.Driving" : "";
        if (!pluginName || typeof AMap.plugin !== "function") {
          fallback();
          return;
        }
        AMap.plugin([pluginName], () => {
          const Service = pluginName.split(".").reduce((target: any, key: string) => target?.[key], window as any);
          if (!Service) {
            fallback();
            return;
          }
          const service = new Service({ autoFitView: false });
          service.search(origin, destination, (status: string, result: any) => {
            if (drawIdRef.current !== drawId) return;
            const routePath = result?.routes?.[0]?.steps?.flatMap((step: any) => step.path || []) || [];
            if (status === "complete" && routePath.length > 1) {
              addPolyline(routePath, color, leg, toStop);
            } else {
              fallback();
            }
          });
        });
      };
      getOrderedDayLegs(day).forEach((leg) => {
        const fromStop = stopsByOrder.get(leg.fromOrder);
        const toStop = stopsByOrder.get(leg.toOrder);
        if (fromStop?.longitude != null && fromStop.latitude != null && toStop?.longitude != null && toStop.latitude != null) {
          searchRoute(leg, fromStop, toStop, color);
          return;
        }
        const path = leg.routeGeometry?.length ? leg.routeGeometry : [];
        addPolyline(path, color, leg, toStop);
      });
    });
    const fitSignature = JSON.stringify(bounds);
    if (bounds.length && fitSignatureRef.current !== fitSignature) {
      fitSignatureRef.current = fitSignature;
      map.setFitView(fitOverlaysRef.current, false, [80, 80, 80, 80]);
    }
    enableMapInteraction(map);
    window.setTimeout(refreshOverlayMarkers, 80);
    return () => {
      drawIdRef.current += 1;
    };
  }, [key, mapReadyTick, refreshOverlayMarkers, visibleDays]);

  const restoreRecommendedView = () => {
    const map = amapRef.current;
    if (!map) return;
    const fitTargets = fitOverlaysRef.current.length ? fitOverlaysRef.current : overlaysRef.current;
    if (fitTargets.length && typeof map.setFitView === "function") {
      map.setFitView(fitTargets, false, [90, 90, 90, 90]);
    }
    enableMapInteraction(map);
  };

  const locateCurrentPosition = () => {
    const map = amapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || !navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = [position.coords.longitude, position.coords.latitude];
        if (currentLocationMarkerRef.current) {
          try {
            map.remove(currentLocationMarkerRef.current);
          } catch {
            // The marker may have been removed when the map redrew.
          }
          overlaysRef.current = overlaysRef.current.filter((overlay) => overlay !== currentLocationMarkerRef.current);
        }
        const marker = new AMap.Marker({
          position: point,
          anchor: "center",
          content: `<span class="amap-current-marker" title="当前位置" aria-label="当前位置">📍</span>`,
          zIndex: 260,
          bubble: false
        });
        currentLocationMarkerRef.current = marker;
        overlaysRef.current.push(marker);
        map.add(marker);
        if (typeof map.setZoomAndCenter === "function") {
          map.setZoomAndCenter(Math.max(Number(map.getZoom?.()) || 14, 15), point);
        } else {
          map.setCenter(point);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const beginMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const map = amapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || event.button !== 0) return;
    const center = map.getCenter?.();
    const centerPixel = center && map.lngLatToContainer?.(center);
    dragRef.current = { active: true, x: event.clientX, y: event.clientY, centerPixel, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    enableMapInteraction(map);
  };

  const moveMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const map = amapRef.current;
    const AMap = (window as any).AMap;
    const drag = dragRef.current;
    if (!drag.active || !map || !AMap || !drag.centerPixel || typeof map.containerToLngLat !== "function") return;
    const dx = (event.clientX - drag.x) * MAP_DRAG_SENSITIVITY;
    const dy = (event.clientY - drag.y) * MAP_DRAG_SENSITIVITY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const startX = Number(drag.centerPixel.x ?? drag.centerPixel.getX?.() ?? 0);
    const startY = Number(drag.centerPixel.y ?? drag.centerPixel.getY?.() ?? 0);
    const nextCenter = map.containerToLngLat(new AMap.Pixel(startX - dx, startY - dy));
    map.setCenter(nextCenter, true);
    refreshOverlayMarkers();
    event.preventDefault();
  };

  const endMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    window.setTimeout(refreshOverlayMarkers, 20);
  };

  const zoomMap = (event: ReactWheelEvent<HTMLDivElement>) => {
    const map = amapRef.current;
    if (!map || typeof map.getZoom !== "function" || typeof map.setZoom !== "function") return;
    event.preventDefault();
    const currentZoom = Number(map.getZoom()) || 11;
    const delta = Math.max(-1, Math.min(1, -event.deltaY / 240));
    const nextZoom = Math.max(3, Math.min(20, currentZoom + delta * MAP_WHEEL_STEP));
    map.setZoom(nextZoom, true);
    window.setTimeout(refreshOverlayMarkers, 20);
  };

  if (!key) {
    return <FallbackMap plan={plan} activeDay={activeDay} selectedStop={selectedStop} onSelectStop={onSelectStop} />;
  }

  return (
    <div className="travel-map amap-map-shell">
      <div className="amap-canvas" ref={mapRef} onPointerEnter={() => amapRef.current && enableMapInteraction(amapRef.current)} />
      <div
        className="travel-map-interaction"
        onPointerDown={beginMapDrag}
        onPointerMove={moveMapDrag}
        onPointerUp={endMapDrag}
        onPointerCancel={endMapDrag}
        onWheel={zoomMap}
      >
        {overlayMarkers.map((marker) => (
          <button
            className={selectedStop === marker.key ? "amap-love-marker active" : "amap-love-marker"}
            type="button"
            key={marker.key}
            style={{ left: marker.x, top: marker.y, ["--marker-color" as string]: marker.color, ["--marker-soft" as string]: marker.soft }}
            title={marker.stop.name}
            aria-label={`查看 ${marker.stop.name || `第 ${marker.stop.order} 个地点`}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelectStop(marker.stop);
            }}
          >
            <span className="marker-hit-area"></span>
            <span className="marker-day">Day {marker.stop.dayNumber}</span>
            <span className="marker-bubble"><span>{stopMarkerEmojis[marker.stop.type] || "💗"}</span><b>{marker.stop.order}</b></span>
          </button>
        ))}
      </div>
      <div className="travel-map-tools">
        <button type="button" onClick={locateCurrentPosition} disabled={locating}><Crosshair size={15} />{locating ? "定位中" : "定位当前位置"}</button>
        <button type="button" onClick={restoreRecommendedView}><RotateCcw size={15} />恢复推荐视野</button>
      </div>
      <div className="travel-map-day-legend">
        {visibleDays.map((day) => (
          <span key={day.dayNumber} style={{ ["--day-color" as string]: day.themeColor || dayColors[(day.dayNumber - 1) % dayColors.length] }}>Day {day.dayNumber}</span>
        ))}
      </div>
    </div>
  );
}

function FallbackMap({ plan, activeDay, selectedStop, onSelectStop }: { plan: TravelPlan | null; activeDay: number | "all"; selectedStop?: string; onSelectStop: (stop: TravelStop) => void }) {
  const days = !plan ? [] : activeDay === "all" ? plan.days : plan.days.filter((day) => day.dayNumber === activeDay);
  const stops = days.flatMap((day) => day.stops.map((stop) => ({ ...stop, color: day.themeColor || dayColors[(day.dayNumber - 1) % dayColors.length] })));
  const coordinateStops = stops.filter((stop) => typeof stop.longitude === "number" && typeof stop.latitude === "number");
  const useCoordinates = coordinateStops.length >= Math.max(2, Math.ceil(stops.length * 0.5));
  const lngs = coordinateStops.map((stop) => stop.longitude as number);
  const lats = coordinateStops.map((stop) => stop.latitude as number);
  const minLng = Math.min(...lngs, 0);
  const maxLng = Math.max(...lngs, 1);
  const minLat = Math.min(...lats, 0);
  const maxLat = Math.max(...lats, 1);
  const lngSpan = Math.max(maxLng - minLng, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const maxStopsInDay = Math.max(1, ...days.map((day) => day.stops.length));
  const positionOf = (stop: TravelStop & { color?: string }, fallbackIndex = 0) => {
    if (useCoordinates && typeof stop.longitude === "number" && typeof stop.latitude === "number") {
      return {
        x: 10 + ((stop.longitude - minLng) / lngSpan) * 80,
        y: 88 - ((stop.latitude - minLat) / latSpan) * 76,
      };
    }
    const dayIndex = Math.max(0, days.findIndex((day) => day.dayNumber === stop.dayNumber));
    const stopIndex = Math.max(0, days[dayIndex]?.stops.findIndex((item) => item.order === stop.order) ?? fallbackIndex);
    return {
      x: 12 + (stopIndex / Math.max(1, maxStopsInDay - 1)) * 76,
      y: 18 + (dayIndex / Math.max(1, days.length - 1)) * 62,
    };
  };
  const stopKey = (stop: Pick<TravelStop, "dayNumber" | "order" | "name">) => `${stop.dayNumber}-${stop.order}-${stop.name}`;
  const basePositions = new Map(stops.map((stop, index) => [stopKey(stop), positionOf(stop, index)]));
  const visualGroups = new Map<string, Array<TravelStop & { color?: string }>>();
  stops.forEach((stop) => {
    const position = basePositions.get(stopKey(stop)) || positionOf(stop);
    const key = `${Math.round(position.x / 3)}:${Math.round(position.y / 3)}`;
    visualGroups.set(key, [...(visualGroups.get(key) || []), stop]);
  });
  const positions = new Map(stops.map((stop, index) => {
    const position = basePositions.get(stopKey(stop)) || positionOf(stop, index);
    const groupKey = `${Math.round(position.x / 3)}:${Math.round(position.y / 3)}`;
    const group = visualGroups.get(groupKey) || [stop];
    const offset = overlapOffset(group.findIndex((item) => item.order === stop.order && item.dayNumber === stop.dayNumber), group.length);
    return [stopKey(stop), {
      x: Math.max(5, Math.min(95, position.x + offset.x / 6)),
      y: Math.max(7, Math.min(93, position.y + offset.y / 6)),
    }];
  }));

  return (
    <div className="travel-map fallback-map">
      <div className="soft-map-grid" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {days.map((day) => {
          const points = day.stops.map((stop) => positions.get(stopKey(stop))).filter(Boolean) as { x: number; y: number }[];
          const color = day.themeColor || dayColors[(day.dayNumber - 1) % dayColors.length];
          return points.slice(1).map((point, index) => {
            const previous = points[index];
            const path = `M ${previous.x} ${previous.y} C ${(previous.x + point.x) / 2} ${previous.y - 10}, ${(previous.x + point.x) / 2} ${point.y + 10}, ${point.x} ${point.y}`;
            return (
              <g key={`${day.dayNumber}-${index}`}>
                <path d={path} fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" />
                <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeDasharray={index % 2 ? "4 2" : ""} />
                <path d={path} fill="none" stroke="#ffd1e6" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.2 4" />
              </g>
            );
          });
        })}
      </svg>
      {days.flatMap((day) => {
        const stopsByOrder = new Map(day.stops.map((stop) => [stop.order, stop]));
        return getOrderedDayLegs(day).map((leg, index) => {
          const toStop = stopsByOrder.get(leg.toOrder);
          if (!toStop) return null;
          const position = positions.get(stopKey(toStop));
          if (!position) return null;
          return <span className="fallback-route-label" key={`fallback-leg-${day.dayNumber}-${index}`} style={{ left: `${position.x}%`, top: `${Math.max(5, position.y - 8)}%`, ["--day-color" as string]: dayColors[(day.dayNumber - 1) % dayColors.length] }}>{routeLabel(leg)}</span>;
        });
      })}
      {days.map((day) => {
        const firstStop = day.stops[0];
        const position = firstStop ? positions.get(stopKey(firstStop)) || positionOf(firstStop) : undefined;
        if (!position) return null;
        return <span className="fallback-day-label" key={`day-label-${day.dayNumber}`} style={{ left: `${Math.max(5, position.x - 3)}%`, top: `${Math.max(5, position.y - 11)}%`, ["--day-color" as string]: dayColors[(day.dayNumber - 1) % dayColors.length] }}>Day {day.dayNumber}</span>;
      })}
      {stops.map((stop, index) => {
        const position = positions.get(stopKey(stop)) || positionOf(stop, index);
        return (
          <button className={selectedStop === stopDomKey(stop) ? "fallback-marker active" : "fallback-marker"} type="button" key={`${stop.dayNumber}-${stop.order}-${stop.name}`} style={{ left: `${position.x}%`, top: `${position.y}%`, ["--marker-color" as string]: stop.color }} onClick={() => onSelectStop(stop)}>
            <span className="fallback-marker-emoji">{stopMarkerEmojis[stop.type] || "💗"}</span>
            <b>{stop.order}</b>
          </button>
        );
      })}
      <span className="map-empty-hint">{stops.length ? (useCoordinates ? "未配置高德 Key，当前按经纬度生成粉色示意地图。" : "未配置高德 Key，当前按每天行程顺序生成示意地图。") : "还没有地点，先在左侧添加行程节点吧。"}</span>
    </div>
  );
}

function TravelTimeline({ day, selectedStop, onSelectStop, onOpenImages }: { day: TravelDay; selectedStop?: string; onSelectStop: (stop: TravelStop) => void; onOpenImages: (images: string[], index: number) => void }) {
  const legsByPair = new Map(getOrderedDayLegs(day).map((leg) => [`${leg.fromOrder}-${leg.toOrder}`, leg]));
  return (
    <div className="travel-timeline">
      <div className="day-sticker" style={{ ["--day-color" as string]: day.themeColor || dayColors[day.dayNumber - 1] }}>Day {day.dayNumber}</div>
      {day.stops.map((stop, index) => {
        const Icon = stopIcons[stop.type] || Heart;
        const leg = day.stops[index + 1] ? legsByPair.get(`${stop.order}-${day.stops[index + 1].order}`) : undefined;
        const TransportIcon = leg ? transportIcons[primaryTransport(leg)] : Route;
        const images = stopImages(stop).map(normalizeUrl);
        return (
          <div key={`${stop.order}-${stop.name}`}>
            <button className={selectedStop === stop.id ? "travel-stop-card active" : "travel-stop-card"} type="button" onClick={() => onSelectStop(stop)}>
              <span className="stop-time">{stop.arriveTime || "--:--"}</span>
              <span className="stop-icon"><Icon size={17} /></span>
              <strong>{stop.name}</strong>
              <small>{stopTypeLabels[stop.type]} · 停留 {stop.stayMinutes || 0} 分钟 · {formatMoney(stop.cost)}</small>
              {stop.recommendedFood && <em>推荐：{stop.recommendedFood}</em>}
              {stop.warning && <i><AlertTriangle size={13} />{stop.warning}</i>}
            </button>
            {images.length > 0 && (
              <div className="travel-stop-image-strip">
                {images.slice(0, 4).map((image, imageIndex) => (
                  <button type="button" key={`${image}-${imageIndex}`} onClick={(event) => { event.stopPropagation(); onOpenImages(images, imageIndex); }} aria-label={`查看${stop.name || "地点"}照片 ${imageIndex + 1}`}>
                    {isVideoAsset(image) ? <video src={image} muted playsInline preload="metadata" /> : <img src={image} alt="" />}
                  </button>
                ))}
                {images.length > 4 && <span>+{images.length - 4}</span>}
              </div>
            )}
            {leg && (
              <div className="travel-leg-card">
                <TransportIcon size={15} />
                <span>{transportText(leg)} · {leg.plannedMinutes || leg.mapMinutes || "--"} 分钟 · {formatMoney(leg.plannedCost)}</span>
                {leg.note && <small>{leg.note}</small>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TravelEditor({ countdownId, draft, setDraft, onOpenImages }: { countdownId: string; draft: TravelPlan; setDraft: (next: TravelPlan) => void; onOpenImages?: (images: string[], index: number) => void }) {
  const [activeDayNumber, setActiveDayNumber] = useState(draft.days[0]?.dayNumber ?? 1);
  const [activeEditPanel, setActiveEditPanel] = useState<"stops" | "legs">("stops");
  const activeDay = draft.days.find((day) => day.dayNumber === activeDayNumber) || draft.days[0];

  useEffect(() => {
    if (!draft.days.some((day) => day.dayNumber === activeDayNumber)) {
      setActiveDayNumber(draft.days[0]?.dayNumber ?? 1);
    }
  }, [activeDayNumber, draft.days]);

  const updateDay = (dayNumber: number, patch: Partial<TravelDay>) => {
    setDraft({ ...draft, days: draft.days.map((day) => day.dayNumber === dayNumber ? { ...day, ...patch } : day) });
  };
  const addDay = () => {
    const lastDay = draft.days[draft.days.length - 1];
    const dayNumber = (lastDay?.dayNumber ?? 0) + 1;
    const date = dayjs(draft.startDate).add(dayNumber - 1, "day").format("YYYY-MM-DD");
    setDraft({ ...draft, endDate: date, days: [...draft.days, { dayNumber, date, title: `Day ${dayNumber}`, summary: "", themeColor: dayColors[(dayNumber - 1) % dayColors.length], stops: [], legs: [] }] });
    setActiveDayNumber(dayNumber);
    setActiveEditPanel("stops");
  };
  const addStop = (dayNumber: number) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    if (!day) return;
    const lastStop = day.stops[day.stops.length - 1];
    const order = (lastStop?.order ?? 0) + 1;
    updateDay(dayNumber, { stops: [...day.stops, { dayNumber, order, type: order === 1 ? "start" : "scenic", name: "", city: draft.destination, address: "", arriveTime: "", leaveTime: "" }] });
    window.setTimeout(() => document.getElementById(`travel-edit-stop-${dayNumber}-${order}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };
  const updateStop = (dayNumber: number, order: number, patch: Partial<TravelStop>) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    if (!day) return;
    const affectsRoute = "name" in patch || "city" in patch || "address" in patch || "longitude" in patch || "latitude" in patch;
    updateDay(dayNumber, {
      stops: day.stops.map((stop) => stop.order === order ? { ...stop, ...patch } : stop),
      legs: affectsRoute ? day.legs.map((leg) => leg.fromOrder === order || leg.toOrder === order ? { ...leg, routeGeometry: undefined, mapMinutes: undefined, mapDistanceKm: undefined } : leg) : day.legs
    });
  };
  const uploadStopImage = async (event: ChangeEvent<HTMLInputElement>, dayNumber: number, order: number) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const uploaded = await api.upload("travel", file);
      uploadedUrls.push(uploaded.url);
    }
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    const stop = day?.stops.find((item) => item.order === order);
    const imageUrls = [...stopImages(stop), ...uploadedUrls];
    updateStop(dayNumber, order, { imageUrl: imageUrls[0], imageUrls });
  };
  const removeStopImage = (dayNumber: number, order: number, imageIndex: number) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    const stop = day?.stops.find((item) => item.order === order);
    if (!stop) return;
    const imageUrls = stopImages(stop).filter((_, index) => index !== imageIndex);
    updateStop(dayNumber, order, { imageUrl: imageUrls[0] || undefined, imageUrls });
  };
  const removeStop = (dayNumber: number, order: number) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    if (!day) return;
    updateDay(dayNumber, { stops: day.stops.filter((stop) => stop.order !== order), legs: day.legs.filter((leg) => leg.fromOrder !== order && leg.toOrder !== order) });
  };
  const locateStop = async (dayNumber: number, order: number) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    const stop = day?.stops.find((item) => item.order === order);
    if (!stop) return;
    const result = await api.countdowns.travelPlan.geocode(countdownId, {
      city: stop.city || draft.destination,
      address: stop.address || stop.city || draft.destination
    }).catch(() => null);
    if (result?.ok && result.longitude != null && result.latitude != null) {
      updateStop(dayNumber, order, { longitude: result.longitude, latitude: result.latitude });
    }
  };
  const addLeg = (dayNumber: number) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    if (!day || day.stops.length < 2) return;
    const from = day.stops[Math.max(0, day.stops.length - 2)];
    const to = day.stops[day.stops.length - 1];
    const nextIndex = day.legs.length;
    updateDay(dayNumber, { legs: [...day.legs, { dayNumber, fromOrder: from.order, toOrder: to.order, transport: "other", transports: ["other"], useMapRoute: true }] });
    window.setTimeout(() => document.getElementById(`travel-edit-leg-${dayNumber}-${nextIndex}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };
  const updateLeg = (dayNumber: number, index: number, patch: Partial<TravelLeg>) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    if (!day) return;
    const affectsRoute = "fromOrder" in patch || "toOrder" in patch || "transport" in patch || "transports" in patch;
    updateDay(dayNumber, { legs: day.legs.map((leg, legIndex) => legIndex === index ? { ...leg, ...patch, ...(affectsRoute ? { routeGeometry: undefined, mapMinutes: undefined, mapDistanceKm: undefined } : {}) } : leg) });
  };
  const removeLeg = (dayNumber: number, index: number) => {
    const day = draft.days.find((item) => item.dayNumber === dayNumber);
    if (!day) return;
    updateDay(dayNumber, { legs: day.legs.filter((_, legIndex) => legIndex !== index) });
  };

  return (
    <div className="travel-editor">
      <div className="form-grid">
        <label>旅行标题<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>目的地<input value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} /></label>
        <label>开始日期<input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label>
        <label>结束日期<input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label>
        <label className="full">旅行简介<textarea rows={3} value={draft.intro || ""} onChange={(event) => setDraft({ ...draft, intro: event.target.value })} /></label>
      </div>
      <div className="travel-editor-toolbar">
        <div className="travel-editor-day-tabs">
          {draft.days.map((day) => (
            <button className={activeDayNumber === day.dayNumber ? "active" : ""} type="button" key={day.dayNumber} onClick={() => setActiveDayNumber(day.dayNumber)} style={{ ["--day-color" as string]: dayColors[(day.dayNumber - 1) % dayColors.length] }}>
              Day {day.dayNumber}
            </button>
          ))}
        </div>
        <button className="ghost-button" type="button" onClick={addDay}><Plus size={15} />增加一天</button>
      </div>
      {activeDay && (
        <section className="travel-edit-day" key={activeDay.dayNumber} style={{ ["--day-color" as string]: dayColors[(activeDay.dayNumber - 1) % dayColors.length], ["--day-soft" as string]: daySoftColors[(activeDay.dayNumber - 1) % daySoftColors.length] }}>
          <div className="travel-edit-day-head">
            <strong><span>Day {activeDay.dayNumber}</span><small>{activeDay.stops.length} 个地点 · {activeDay.legs.length || Math.max(0, activeDay.stops.length - 1)} 段交通</small></strong>
            <input type="date" value={activeDay.date} onChange={(event) => updateDay(activeDay.dayNumber, { date: event.target.value })} title="这一天对应的日期" />
            <input value={activeDay.summary || ""} onChange={(event) => updateDay(activeDay.dayNumber, { summary: event.target.value })} placeholder="当天简介，例如：抵达杭州，晚上去湖边散步" title="写一句当天主题或安排摘要" />
            {activeEditPanel === "stops" ? (
              <button className="ghost-button" type="button" onClick={() => addStop(activeDay.dayNumber)}><Plus size={14} />地点</button>
            ) : (
              <button className="ghost-button" type="button" onClick={() => addLeg(activeDay.dayNumber)}><Route size={14} />交通段</button>
            )}
          </div>
          <div className="travel-editor-pane-tabs">
            <button className={activeEditPanel === "stops" ? "active" : ""} type="button" onClick={() => setActiveEditPanel("stops")}>地点安排</button>
            <button className={activeEditPanel === "legs" ? "active" : ""} type="button" onClick={() => setActiveEditPanel("legs")}>交通段</button>
          </div>
          {activeEditPanel === "stops" && activeDay.stops.map((stop) => (
            <div className="travel-stop-editor" id={`travel-edit-stop-${activeDay.dayNumber}-${stop.order}`} key={stop.order}>
              <div className="travel-stop-editor-title">
                <span>{stopMarkerEmojis[stop.type] || "💗"}</span>
                <strong>{stop.order}. {stop.name || "待填写地点"}</strong>
                <small>填写地点后可一键定位，路线会跟着刷新</small>
                <button className="icon-button danger" type="button" onClick={() => removeStop(activeDay.dayNumber, stop.order)} aria-label="删除地点"><Trash2 size={15} /></button>
              </div>
              <TravelEditField label="地点类型" hint="会影响地图图标和时间线样式"><TypeSelect value={stop.type} onChange={(type) => updateStop(activeDay.dayNumber, stop.order, { type })} /></TravelEditField>
              <TravelEditField label="地点" className="wide" hint="只作为地图上的显示文字，不参与定位"><input value={stop.name} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { name: event.target.value })} placeholder="例如：西湖断桥" /></TravelEditField>
              <TravelEditField label="城市/详细地址" className="wide" hint="定位会按这里查找，尽量写城市 + 街道或景区地址"><input value={stop.address || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { city: draft.destination, address: event.target.value, longitude: undefined, latitude: undefined })} placeholder="例如：杭州 北山街 / 杭州东站东广场" /></TravelEditField>
              <div className="travel-locate-field">
                <button className="ghost-button" type="button" onClick={() => void locateStop(activeDay.dayNumber, stop.order)}><Crosshair size={15} />按地址定位</button>
                <small>{stop.longitude && stop.latitude ? "已定位，保存后路线会重新生成" : "未定位，保存时也会自动尝试定位"}</small>
              </div>
              <TravelEditField label="到达时间" hint="点一下就能选时间"><input type="time" value={stop.arriveTime || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { arriveTime: event.target.value })} /></TravelEditField>
              <TravelEditField label="离开时间" hint="点一下就能选时间"><input type="time" value={stop.leaveTime || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { leaveTime: event.target.value })} /></TravelEditField>
              <TravelEditField label="停留时长" unit="分钟" hint="预计在这里停留多久"><input type="number" value={stop.stayMinutes ?? ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { stayMinutes: event.target.value ? Number(event.target.value) : undefined })} placeholder="90" /></TravelEditField>
              <TravelEditField label="地点花费" unit="元" hint="门票、餐饮或购物预算"><input type="number" value={stop.cost ?? ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { cost: event.target.value ? Number(event.target.value) : undefined })} placeholder="80" /></TravelEditField>
              <TravelEditField label="开放时间" hint="景点或店铺营业时间"><input value={stop.openTime || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { openTime: event.target.value })} placeholder="06:00-22:00" /></TravelEditField>
              <TravelEditField label="门票" hint="可写免费、价格或购票提醒"><input value={stop.ticket || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { ticket: event.target.value })} placeholder="免费 / 80元 / 需预约" /></TravelEditField>
              {stop.type === "restaurant" && (
                <>
                  <TravelEditField label="饭点类型" hint="早餐、午餐、晚餐或下午茶"><input value={stop.mealType || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { mealType: event.target.value })} placeholder="午餐" /></TravelEditField>
                  <TravelEditField label="推荐菜品" hint="想让她尝尝的内容"><input value={stop.recommendedFood || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { recommendedFood: event.target.value })} placeholder="东坡肉、龙井虾仁、奶茶" /></TravelEditField>
                </>
              )}
              <TravelEditField label="攻略内容" className="wide" hint="怎么逛、从哪里进、哪里拍照好看"><textarea value={stop.guide || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { guide: event.target.value })} placeholder="例如：建议从断桥开始步行，傍晚去湖边拍照。" /></TravelEditField>
              <TravelEditField label="避雷提示" className="wide" hint="排队、人多、容易踩坑的地方"><textarea value={stop.warning || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { warning: event.target.value })} placeholder="例如：节假日人多，建议早点到。" /></TravelEditField>
              <TravelEditField label="备注" className="wide" hint="任何额外提醒都可以放这里"><textarea value={stop.note || ""} onChange={(event) => updateStop(activeDay.dayNumber, stop.order, { note: event.target.value })} placeholder="例如：带伞、充电宝、身份证。" /></TravelEditField>
              <div className="travel-stop-photo-field">
                {stopImages(stop).length ? (
                  <div className="travel-stop-photo-grid">
                    {stopImages(stop).map((url, imageIndex) => (
                      <figure key={`${url}-${imageIndex}`}>
                        <button className="travel-stop-photo-preview" type="button" onClick={() => onOpenImages?.(stopImages(stop).map(normalizeUrl), imageIndex)} aria-label={`查看${stop.name || "地点"}照片 ${imageIndex + 1}`}>
                          {isVideoAsset(url)
                            ? <video src={normalizeUrl(url)} muted playsInline preload="metadata" />
                            : <img src={normalizeUrl(url)} alt={`${stop.name || "地点"}照片 ${imageIndex + 1}`} />}
                        </button>
                        <button className="travel-stop-photo-delete" type="button" onClick={(event) => { event.stopPropagation(); removeStopImage(activeDay.dayNumber, stop.order, imageIndex); }} aria-label="删除这张地点照片">
                          <Trash2 size={13} />
                        </button>
                      </figure>
                    ))}
                  </div>
                ) : <span><Camera size={18} />还没有地点照片</span>}
                <label className="ghost-button travel-image-upload"><Camera size={14} />{stopImages(stop).length ? "继续添加照片" : "地点照片"}<input type="file" multiple accept="image/*,video/*,.mov,.mp4,.m4v" hidden onChange={(event) => uploadStopImage(event, activeDay.dayNumber, stop.order)} /></label>
              </div>
            </div>
          ))}
          {activeEditPanel === "legs" && activeDay.legs.map((leg, index) => (
            <div className="travel-leg-editor" id={`travel-edit-leg-${activeDay.dayNumber}-${index}`} key={`${leg.fromOrder}-${leg.toOrder}-${index}`}>
              <div className="travel-leg-editor-title"><Route size={15} /><strong>交通段 {index + 1}</strong><small>路线标签会显示交通方式、耗时和费用</small><button className="icon-button danger travel-leg-delete" type="button" onClick={() => removeLeg(activeDay.dayNumber, index)} aria-label="删除交通段"><Trash2 size={15} /></button></div>
              <TravelEditField label="起点"><StopSelect value={leg.fromOrder} stops={activeDay.stops} onChange={(fromOrder) => updateLeg(activeDay.dayNumber, index, { fromOrder })} /></TravelEditField>
              <TravelEditField label="终点"><StopSelect value={leg.toOrder} stops={activeDay.stops} onChange={(toOrder) => updateLeg(activeDay.dayNumber, index, { toOrder })} /></TravelEditField>
              <TravelEditField label="交通方式" className="wide" hint="可以多选，例如：地铁 + 步行。第一个会决定路线规划方式。">
                <TransportMultiSelect
                  value={legTransports(leg)}
                  onChange={(transports) => updateLeg(activeDay.dayNumber, index, { transports, transport: transports[0] })}
                />
              </TravelEditField>
              <TravelEditField label="出发时间" hint="点一下就能选时间"><input type="time" value={leg.departTime || ""} onChange={(event) => updateLeg(activeDay.dayNumber, index, { departTime: event.target.value })} /></TravelEditField>
              <TravelEditField label="到达时间" hint="点一下就能选时间"><input type="time" value={leg.arriveTime || ""} onChange={(event) => updateLeg(activeDay.dayNumber, index, { arriveTime: event.target.value })} /></TravelEditField>
              <TravelEditField label="计划耗时" unit="分钟"><input type="number" value={leg.plannedMinutes ?? ""} onChange={(event) => updateLeg(activeDay.dayNumber, index, { plannedMinutes: event.target.value ? Number(event.target.value) : undefined })} placeholder="35" /></TravelEditField>
              <TravelEditField label="计划费用" unit="元"><input type="number" value={leg.plannedCost ?? ""} onChange={(event) => updateLeg(activeDay.dayNumber, index, { plannedCost: event.target.value ? Number(event.target.value) : undefined })} placeholder="6" /></TravelEditField>
              <TravelEditField label="交通备注" className="wide" hint="例如出口、换乘、打车点、注意事项"><input value={leg.note || ""} onChange={(event) => updateLeg(activeDay.dayNumber, index, { note: event.target.value })} placeholder="地铁 B 口出站，再步行前往。" /></TravelEditField>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default function TravelPlanWorkspace({ countdown, onClose }: TravelPlanWorkspaceProps) {
  const { canEdit } = useAuth();
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [draft, setDraft] = useState<TravelPlan>(() => emptyPlan(countdown));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number | "all">("all");
  const [selectedStop, setSelectedStop] = useState<TravelStop | null>(null);
  const [travelLightbox, setTravelLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapSettings, setMapSettings] = useState<MapKeySettings>({ amapJsKey: "", hasWebServiceKey: false });
  const [keyDraft, setKeyDraft] = useState({ amapJsKey: "", amapWebServiceKey: "" });

  useEffect(() => {
    setLoading(true);
    api.countdowns.travelPlan.get(countdown.id)
      .then((value) => {
        setPlan(value);
        setDraft(value || emptyPlan(countdown));
        setEditing(!value && canEdit);
      })
      .catch(() => {
        setPlan(null);
        setDraft(emptyPlan(countdown));
      })
      .finally(() => setLoading(false));
  }, [canEdit, countdown]);

  useEffect(() => {
    api.settings.mapKeys.get()
      .then((settings) => {
        setMapSettings(settings);
        setKeyDraft({ amapJsKey: settings.amapJsKey || "", amapWebServiceKey: "" });
      })
      .catch(() => undefined);
  }, []);

  const visibleDays = activeDay === "all" ? (plan || draft).days : (plan || draft).days.filter((day) => day.dayNumber === activeDay);
  const savePlan = async () => {
    const saved = await api.countdowns.travelPlan.save(countdown.id, draft, Boolean(plan));
    setPlan(saved);
    setDraft(saved);
    setEditing(false);
  };

  const importExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await api.countdowns.travelPlan.importExcel(countdown.id, file, plan ? "overwrite" : "overwrite");
    if (result.ok && result.plan) {
      setPlan(result.plan);
      setDraft(result.plan);
      setEditing(false);
      setImportErrors([]);
    } else {
      setImportErrors(result.errors.map((error) => `${error.sheet} 第 ${error.row} 行 · ${error.field}：${error.reason}。${error.suggestion}`));
    }
  };

  const selectStop = useCallback((stop: TravelStop) => {
    setSelectedStop(stop);
    if (window.matchMedia("(max-width: 768px)").matches) return;
    document.getElementById(`travel-stop-${stop.dayNumber}-${stop.order}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const saveMapKeys = async () => {
    const saved = await api.settings.mapKeys.update(keyDraft);
    setMapSettings(saved);
    setKeyDraft({ amapJsKey: saved.amapJsKey || "", amapWebServiceKey: "" });
    setSettingsOpen(false);
  };

  const currentPlan = editing ? draft : plan;

  return (
    <Modal open title="旅行攻略地图" onClose={onClose} panelClassName="travel-modal-panel">
      <div className="travel-workspace">
        {loading ? <div className="soft-empty">正在打开这份旅行攻略...</div> : (
          <>
            <header className="travel-hero">
              <div>
                <p className="eyebrow">Travel Plan</p>
                <h2>{currentPlan?.title || "还没有旅行攻略"}</h2>
                <p>{currentPlan ? `${dayRange(currentPlan)} · ${currentPlan.destination || "目的地待定"}` : "把路上的每一站都温柔地串起来。"}</p>
              </div>
              <div className="travel-stats">
                <span><CalendarDays size={16} />{currentPlan?.days.length || 0} 天</span>
                <span><MapPinned size={16} />{stopCount(currentPlan)} 个地点</span>
                <span><Route size={16} />{Math.round(totalMinutes(currentPlan) / 60)} 小时交通</span>
                <span><Sparkles size={16} />{formatMoney(totalCost(currentPlan))}</span>
              </div>
              <div className="travel-actions">
                {canEdit && <button className="ghost-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "查看地图" : plan ? "编辑攻略" : "创建攻略"}</button>}
                {canEdit && <button className="ghost-button" type="button" onClick={() => setSettingsOpen(true)}><KeyRound size={15} />地图 Key 设置</button>}
                {canEdit && <a className="ghost-button" href={absoluteUrl("/api/countdowns/travel-plan/template")}><FileSpreadsheet size={15} />下载 Excel 模板</a>}
                {canEdit && <label className="ghost-button import-button"><FileUp size={15} />导入攻略数据<input type="file" accept=".xlsx" hidden onChange={importExcel} /></label>}
                {currentPlan && <a className="ghost-button" href={absoluteUrl(`/api/countdowns/${countdown.id}/travel-plan/export`)}><Download size={15} />导出攻略数据</a>}
                {canEdit && <button className="primary-button" type="button" onClick={savePlan} disabled={!editing}><Save size={15} />保存攻略</button>}
              </div>
            </header>

            {importErrors.length > 0 && (
              <div className="travel-import-errors">
                <strong>导入校验没有通过</strong>
                {importErrors.map((error) => <p key={error}>{error}</p>)}
                <button className="ghost-button" type="button" onClick={() => {
                  const blob = new Blob([importErrors.join("\n")], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "travel-import-errors.txt";
                  link.click();
                  URL.revokeObjectURL(url);
                }}><Download size={15} />下载错误报告</button>
              </div>
            )}

            {editing ? (
              <TravelEditor countdownId={countdown.id} draft={draft} setDraft={setDraft} onOpenImages={(images, index) => setTravelLightbox({ images, index })} />
            ) : currentPlan ? (
              <>
                <div className="travel-tabs">
                  <button className={activeDay === "all" ? "active" : ""} type="button" onClick={() => setActiveDay("all")}>全部行程</button>
                  {currentPlan.days.map((day) => <button className={activeDay === day.dayNumber ? "active" : ""} type="button" key={day.dayNumber} onClick={() => setActiveDay(day.dayNumber)}>Day {day.dayNumber}</button>)}
                </div>
                <div className="travel-layout">
                  <aside className="travel-left">
                    {visibleDays.map((day) => (
                      <div key={day.dayNumber}>
                        <TravelTimeline day={day} selectedStop={selectedStop?.id} onSelectStop={selectStop} onOpenImages={(images, index) => setTravelLightbox({ images, index })} />
                        {day.stops.map((stop) => <span id={`travel-stop-${stop.dayNumber}-${stop.order}`} key={`anchor-${stop.order}`} />)}
                      </div>
                    ))}
                  </aside>
                  <section className="travel-right">
                    <TravelMap plan={currentPlan} activeDay={activeDay} selectedStop={selectedStop ? stopDomKey(selectedStop) : undefined} onSelectStop={selectStop} amapKey={mapSettings.amapJsKey} />
                    <AnimatePresence>
                      {selectedStop && (
                        <motion.div className="travel-stop-popover" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }}>
                          {stopImages(selectedStop).length > 0 && (
                            <div className="travel-stop-popover-carousel">
                              <ImageStackCarousel
                                images={stopImages(selectedStop).map(normalizeUrl)}
                                onOpen={(imageIndex) => setTravelLightbox({ images: stopImages(selectedStop).map(normalizeUrl), index: imageIndex })}
                              />
                            </div>
                          )}
                          <strong>{selectedStop.name}</strong>
                          <p>{selectedStop.arriveTime || "--:--"} 到达 · {selectedStop.leaveTime || "--:--"} 离开 · 停留 {selectedStop.stayMinutes || 0} 分钟</p>
                          <small>{stopTypeLabels[selectedStop.type]} · 门票 {selectedStop.ticket || "未填写"} · 开放 {selectedStop.openTime || "未填写"}</small>
                          {selectedStop.guide && <em>💗 {selectedStop.guide}</em>}
                          {selectedStop.warning && <i>⚡ {selectedStop.warning}</i>}
                          {selectedStop.note && <span>{selectedStop.note}</span>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                </div>
              </>
            ) : (
              <div className="soft-empty">
                <Heart fill="currentColor" />
                <p>这个旅行约定还没有攻略。登录后可以创建多日行程，或上传 Excel 一键生成地图。</p>
              </div>
            )}
          </>
        )}
      </div>
      <ImageLightbox
        open={Boolean(travelLightbox)}
        images={travelLightbox?.images ?? []}
        index={travelLightbox?.index ?? 0}
        onIndexChange={(nextIndex) => setTravelLightbox((value) => value ? { ...value, index: nextIndex } : value)}
        onClose={() => setTravelLightbox(null)}
      />
      <Modal open={settingsOpen} title="地图 Key 设置" onClose={() => setSettingsOpen(false)} panelClassName="map-key-modal-panel">
        <div className="map-key-form">
          <p>填写高德 Key 后，攻略地图会切换为真实地图。Web Service Key 只保存在后端，用于地理编码，不会在页面回显。</p>
          <label>高德 JS Key<input value={keyDraft.amapJsKey} onChange={(event) => setKeyDraft((value) => ({ ...value, amapJsKey: event.target.value }))} placeholder="用于前端地图展示" /></label>
          <label>高德 Web Service Key<input value={keyDraft.amapWebServiceKey} onChange={(event) => setKeyDraft((value) => ({ ...value, amapWebServiceKey: event.target.value }))} placeholder={mapSettings.hasWebServiceKey ? "已保存，留空则不修改" : "用于后端地理编码"} /></label>
          <span>{mapSettings.hasWebServiceKey ? "Web Service Key 已配置。" : "还没有配置 Web Service Key。"}</span>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={() => setSettingsOpen(false)}>取消</button>
            <button className="primary-button" type="button" onClick={saveMapKeys}>保存 Key</button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
