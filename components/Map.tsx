'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MapGL, { Marker, Source, Layer, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster from 'supercluster';
import { ISSUE_TYPES, SEVERITIES, IssueType, SeverityLevel } from '@/lib/constants';
import { RouteCoordinate } from '@/lib/routing';
import { Crosshair, Flame, Layers as LayersIcon, MapPin, Loader2 } from 'lucide-react';

const STREETS_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    'satellite-tiles': {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics'
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster' as const,
      source: 'satellite-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

interface Report {
  id: string;
  reporter_id: string;
  reporter_name?: string;
  location_lng: number;
  location_lat: number;
  issue_type: string;
  severity: number;
  description: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  confirm_count: number;
  dispute_count: number;
}

interface MapProps {
  reports: Report[];
  onViewportChange: (bounds: [number, number, number, number]) => void;
  onSelectReport: (report: Report) => void;
  selectedReport: Report | null;
  isPinDropMode: boolean;
  setIsPinDropMode: (val: boolean) => void;
  tempPin: { lng: number; lat: number } | null;
  setTempPin: (pin: { lng: number; lat: number } | null) => void;
  viewMode: 'pins' | 'heatmap';
  setViewMode: (mode: 'pins' | 'heatmap') => void;
  isLoading: boolean;
  routeStart: RouteCoordinate | null;
  routeEnd: RouteCoordinate | null;
  routeSelectMode: 'start' | 'end' | null;
  setRouteStart: (coord: RouteCoordinate | null) => void;
  setRouteEnd: (coord: RouteCoordinate | null) => void;
  setRouteSelectMode: (mode: 'start' | 'end' | null) => void;
  routePath: RouteCoordinate[];
  routeScore: number;
}

export default function MapComponent({
  reports,
  onViewportChange,
  onSelectReport,
  selectedReport,
  isPinDropMode,
  tempPin,
  setTempPin,
  viewMode,
  setViewMode,
  isLoading,
  routeStart,
  routeEnd,
  routeSelectMode,
  setRouteStart,
  setRouteEnd,
  setRouteSelectMode,
  routePath,
  routeScore,
}: MapProps) {
  const mapRef = useRef<MapRef>(null);

  const [mapStyleName, setMapStyleName] = useState<'streets' | 'satellite'>('satellite');
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);

  const [viewState, setViewState] = useState({
    longitude: -74.0060, // Default NYC
    latitude: 40.7128,
    zoom: 12,
  });

  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<[number, number, number, number] | null>(null);

  // Get user geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setViewState({
            longitude: longitude,
            latitude: latitude,
            zoom: 14,
          });
          setUserLocation({ lng: longitude, lat: latitude });
        },
        (error) => {
          console.warn('Geolocation access denied/failed, falling back to NYC default.', error);
        }
      );
    }
  }, []);

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation({ lng: longitude, lat: latitude });
          
          if (mapRef.current) {
            mapRef.current.getMap().easeTo({
              center: [longitude, latitude],
              zoom: 15,
              duration: 600
            });
          }
        },
        () => {
          alert("Could not retrieve your location. Make sure GPS/location services are enabled in your browser.");
        }
      );
    }
  };

  // Debounced viewport change triggers parent fetching
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleMapMove = useCallback((evt?: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
    if (evt) {
      setViewState(evt.viewState);
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      const boundsObj = map.getBounds();
      if (!boundsObj) return;
      const minLng = boundsObj.getWest();
      const minLat = boundsObj.getSouth();
      const maxLng = boundsObj.getEast();
      const maxLat = boundsObj.getNorth();
      const boundsArr: [number, number, number, number] = [minLng, minLat, maxLng, maxLat];
      setCurrentBounds(boundsArr);
      onViewportChange(boundsArr);
    }, 400); // 400ms debounce
  }, [onViewportChange]);

  useEffect(() => {
    if (mapLoaded) {
      Promise.resolve().then(() => handleMapMove());
    }
  }, [mapLoaded, handleMapMove]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Format reports into GeoJSON features for supercluster
  const geojsonPoints = useMemo(() => {
    return reports.map((report) => ({
      type: 'Feature' as const,
      properties: {
        cluster: false,
        reportId: report.id,
        report,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [report.location_lng, report.location_lat],
      },
    }));
  }, [reports]);

  // Build Supercluster index
  const superclusterIndex = useMemo(() => {
    const index = new Supercluster({
      radius: 50,
      maxZoom: 15,
    });
    index.load(geojsonPoints);
    return index;
  }, [geojsonPoints]);

  // Compute clusters for current viewport
  const clusters = useMemo(() => {
    if (!currentBounds || viewMode === 'heatmap') return [];
    try {
      return superclusterIndex.getClusters(currentBounds, Math.round(viewState.zoom));
    } catch {
      return [];
    }
  }, [superclusterIndex, viewState.zoom, currentBounds, viewMode]);

  // Handle map click
  const handleMapClick = (e: { lngLat: { lng: number; lat: number } }) => {
    if (routeSelectMode) {
      const { lng, lat } = e.lngLat;
      if (routeSelectMode === 'start') {
        setRouteStart({ lng, lat });
      } else {
        setRouteEnd({ lng, lat });
      }
      setRouteSelectMode(null);
      return;
    }

    if (isPinDropMode) {
      const { lng, lat } = e.lngLat;
      setTempPin({ lng, lat });
    }
  };

  // Zoom into a cluster
  const handleClusterClick = (clusterId: number, longitude: number, latitude: number) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    try {
      const expansionZoom = superclusterIndex.getClusterExpansionZoom(clusterId);
      map.easeTo({
        center: [longitude, latitude],
        zoom: Math.min(expansionZoom, 17),
        duration: 400,
      });
    } catch {
      // expansionZoom might fail if cluster details are stale
      map.easeTo({
        center: [longitude, latitude],
        zoom: viewState.zoom + 2,
        duration: 400,
      });
    }
  };

  // GeoJSON data format for Native Mapbox Heatmap Source
  const heatmapGeojson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: reports.map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.location_lng, r.location_lat],
        },
        properties: {
          severity: r.severity,
        },
      })),
    };
  }, [reports]);

  // GeoJSON data format for Route Path line
  const routeGeojson = useMemo(() => {
    if (!routePath || routePath.length < 2) return null;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: routePath.map((c) => [c.lng, c.lat]),
      },
      properties: {},
    };
  }, [routePath]);

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden border-3 border-black shadow-brutal bg-[#E0DFDB]">
      {/* MapLibre Map Canvas */}
      <MapGL
        {...viewState}
        ref={mapRef}
        onMove={handleMapMove}
        onClick={handleMapClick}
        onLoad={() => setMapLoaded(true)}
        mapStyle={mapStyleName === 'streets' ? STREETS_STYLE : SATELLITE_STYLE}
        cursor={routeSelectMode ? 'crosshair' : isPinDropMode ? 'crosshair' : 'grab'}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* User Current Location Indicator (Blue Dot) */}
        {userLocation && (
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
          >
            <div className="relative flex items-center justify-center h-6 w-6">
              {/* Pulsing Halo */}
              <div className="absolute inset-0 bg-[#0047FF]/35 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
              {/* Outer White Circle */}
              <div className="h-4.5 w-4.5 bg-white rounded-full flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.35)] border-2 border-white">
                {/* Inner Blue Core */}
                <div className="h-2.5 w-2.5 bg-[#0047FF] rounded-full" />
              </div>
            </div>
          </Marker>
        )}

        {/* Heatmap Mode Layers */}
        {viewMode === 'heatmap' && (
          <Source id="heatmap-src" type="geojson" data={heatmapGeojson}>
            <Layer
              id="heatmap-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': [
                  'interpolate',
                  ['linear'],
                  ['get', 'severity'],
                  1, 0.3,
                  2, 0.6,
                  3, 1.0,
                ],
                'heatmap-intensity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 1,
                  9, 3,
                ],
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'rgba(0, 0, 0, 0)',
                  0.2, '#A8FF60', // low
                  0.5, '#FFD400', // med
                  0.8, '#FF5500', // high-gradient
                  1.0, '#FF3366', // impassable
                ],
                'heatmap-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  0, 2,
                  9, 20,
                  16, 40,
                ],
                'heatmap-opacity': 0.85,
              }}
            />
          </Source>
        )}

        {/* Render Clusters & Pins (Only in 'pins' view mode) */}
        {viewMode === 'pins' &&
          clusters.map((cluster) => {
            const [longitude, latitude] = cluster.geometry.coordinates;
            const { cluster: isCluster, point_count: pointCount, report } = cluster.properties;

            if (isCluster) {
              // Bubble Cluster marker
              return (
                <Marker
                  key={`cluster-${cluster.id}`}
                  longitude={longitude}
                  latitude={latitude}
                  anchor="center"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClusterClick(Number(cluster.id), longitude, latitude);
                    }}
                    className="flex items-center justify-center border-2 border-black font-space font-black text-xs text-white shadow-brutal-sm rounded-full shrink-0 transition-transform hover:scale-105 active:scale-95 bg-[#0047FF]"
                    style={{
                      width: `${Math.min(30 + pointCount * 2, 55)}px`,
                      height: `${Math.min(30 + pointCount * 2, 55)}px`,
                      cursor: 'pointer',
                    }}
                  >
                    {pointCount}
                  </button>
                </Marker>
              );
            }

            // Individual Report Pin
            const rep = report as Report;
            const sevData = SEVERITIES[rep.severity as SeverityLevel] || SEVERITIES[1];
            const issueData = ISSUE_TYPES[rep.issue_type as IssueType] || ISSUE_TYPES.other;
            const PinIcon = issueData.icon;
            const isSelected = selectedReport?.id === rep.id;

            return (
              <Marker
                key={`pin-${rep.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="bottom"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isPinDropMode) {
                      onSelectReport(rep);
                    }
                  }}
                  disabled={isPinDropMode}
                  className={`flex items-center justify-center p-1.5 border-2 border-black shadow-brutal-sm transition-all duration-75 relative group ${
                    isSelected ? 'translate-x-[2px] translate-y-[2px] shadow-none ring-2 ring-[#0047FF]' : 'hover:-translate-y-0.5 hover:shadow-brutal'
                  } ${rep.status === 'disputed' ? 'opacity-65 saturate-50' : ''}`}
                  style={{
                    backgroundColor: sevData.hex,
                    cursor: isPinDropMode ? 'default' : 'pointer',
                    borderRadius: '2px', // flat square corners
                  }}
                >
                  <PinIcon className="h-4.5 w-4.5 text-[#0A0A0A] stroke-[2.5]" />
                  
                  {/* Miniature Pin-Drop Tip Triangle for chunky look */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black z-[-1]" />
                </button>
              </Marker>
            );
          })}

        {/* Temporary Report Location Dropped Pin */}
        {isPinDropMode && tempPin && (
          <Marker
            longitude={tempPin.lng}
            latitude={tempPin.lat}
            anchor="bottom"
          >
            <div className="flex items-center justify-center p-2 bg-[#FF3399] border-2 border-black shadow-brutal animate-bounce relative">
              <Crosshair className="h-5 w-5 text-black animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black z-[-1]" />
            </div>
          </Marker>
        )}

        {/* Route Line Render */}
        {routeGeojson && (
          <Source id="route-path-src" type="geojson" data={routeGeojson}>
            <Layer
              id="route-path-casing"
              type="line"
              paint={{
                'line-color': '#0A0A0A',
                'line-width': 8,
                'line-opacity': 0.9,
                'line-join': 'round',
                'line-cap': 'round',
              }}
            />
            <Layer
              id="route-path-line"
              type="line"
              paint={{
                'line-color': 
                  routeScore >= 80 
                    ? '#A8FF60' 
                    : routeScore >= 45 
                      ? '#FFD400' 
                      : '#FF3366',
                'line-width': 4,
                'line-opacity': 1.0,
                'line-join': 'round',
                'line-cap': 'round',
              }}
            />
          </Source>
        )}

        {/* Route Start Point Marker */}
        {routeStart && (
          <Marker
            longitude={routeStart.lng}
            latitude={routeStart.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center justify-center pointer-events-auto">
              <div className="flex items-center justify-center h-7 w-7 bg-[#A8FF60] border-2 border-black font-space font-black text-xs text-[#0A0A0A] shadow-brutal-sm rounded-full select-none">
                S
              </div>
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black z-[-1]" />
            </div>
          </Marker>
        )}

        {/* Route End Point Marker */}
        {routeEnd && (
          <Marker
            longitude={routeEnd.lng}
            latitude={routeEnd.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center justify-center pointer-events-auto">
              <div className="flex items-center justify-center h-7 w-7 bg-[#FF3399] border-2 border-black font-space font-black text-xs text-white shadow-brutal-sm rounded-full select-none">
                E
              </div>
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black z-[-1]" />
            </div>
          </Marker>
        )}
      </MapGL>

      {/* Floating Map Controls overlay */}
      <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="card-brutal px-3 py-1.5 bg-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-brutal-sm pointer-events-auto select-none scale-90 origin-top-left">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0047FF]" />
            <span>Fetching...</span>
          </div>
        )}

        {/* Segmented View Switcher Control */}
        <div className="flex border-2 border-black bg-white shadow-brutal-sm pointer-events-auto">
          <button
            onClick={() => setViewMode('pins')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-tight transition-all border-r border-black cursor-pointer ${
              viewMode === 'pins' ? 'bg-[#0047FF] text-white' : 'bg-white hover:bg-zinc-100 text-[#0A0A0A]'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            Pin View
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
              viewMode === 'heatmap' ? 'bg-[#FF3399] text-white' : 'bg-white hover:bg-zinc-100 text-[#0A0A0A]'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Heatmap
          </button>
        </div>
      </div>

      {/* Floating Map Action Buttons (Right side - Google Maps style controls) */}
      <div className="absolute top-24 right-4 z-10 flex flex-col gap-3 pointer-events-none">
        {/* Locate Me Button */}
        <button
          onClick={handleLocateUser}
          className="btn-brutal-sm p-3 bg-white hover:bg-zinc-100 flex items-center justify-center rounded-full pointer-events-auto shadow-brutal-sm border-2 border-black transition-all hover:scale-105 active:scale-95"
          title="Show current location"
        >
          <Crosshair className="h-5 w-5 text-black stroke-[2.5]" />
        </button>

        {/* Satellite Toggle Button */}
        <button
          onClick={() => setMapStyleName(mapStyleName === 'streets' ? 'satellite' : 'streets')}
          className={`btn-brutal-sm p-3 flex items-center justify-center rounded-full pointer-events-auto shadow-brutal-sm border-2 border-black transition-all hover:scale-105 active:scale-95 ${
            mapStyleName === 'satellite' ? 'bg-[#FF5500] text-white hover:bg-[#FF7733]' : 'bg-white text-black hover:bg-zinc-100'
          }`}
          title="Toggle Satellite / Street Map"
        >
          <LayersIcon className="h-5 w-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Helper crosshair indicator in the center during Pin-Drop Mode */}
      {isPinDropMode && !tempPin && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 select-none">
          <div className="card-brutal p-3 bg-[#FFD400] text-xs font-black uppercase text-[#0A0A0A] shadow-brutal border-2 border-black max-w-xs text-center leading-4 select-none mb-4 animate-pulse">
            📍 TAP THE MAP TO DROP A PIN AT THE ISSUE LOCATION
          </div>
          <div className="relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 border-2 border-dashed border-[#FF3366] rounded-full" />
            <Crosshair className="h-10 w-10 text-[#FF3366] stroke-[2.5]" />
          </div>
        </div>
      )}

      {/* Helper map click indicator during Route Select Mode */}
      {routeSelectMode && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 select-none">
          <div className="card-brutal p-3 bg-[#FFD400] text-xs font-black uppercase text-[#0A0A0A] shadow-brutal border-2 border-black max-w-xs text-center leading-4 select-none mb-4 animate-pulse">
            📍 CLICK ANYWHERE ON THE MAP TO SET ROUTE {routeSelectMode === 'start' ? 'START' : 'DESTINATION'}
          </div>
          <div className="relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 border-2 border-dashed border-[#0047FF] rounded-full" />
            <Crosshair className="h-10 w-10 text-[#0047FF] stroke-[2.5]" />
          </div>
        </div>
      )}
    </div>
  );
}
