'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import MapGL, { Marker, Source, Layer, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster from 'supercluster';
import { useAuth } from './AuthContext';
import { ISSUE_TYPES, SEVERITIES, IssueType, SeverityLevel } from '@/lib/constants';
import { Crosshair, Plus, Flame, Map as MapIcon, Layers as LayersIcon, MapPin, Loader2 } from 'lucide-react';

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
}

export default function MapComponent({
  reports,
  onViewportChange,
  onSelectReport,
  selectedReport,
  isPinDropMode,
  setIsPinDropMode,
  tempPin,
  setTempPin,
  viewMode,
  setViewMode,
  isLoading,
}: MapProps) {
  const { user } = useAuth();
  const mapRef = useRef<MapRef>(null);

  const [mapStyleName, setMapStyleName] = useState<'streets' | 'satellite'>('satellite');

  const [viewState, setViewState] = useState({
    longitude: -74.0060, // Default NYC
    latitude: 40.7128,
    zoom: 12,
  });

  const [mapLoaded, setMapLoaded] = useState(false);

  // Get user geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            zoom: 14,
          });
        },
        (error) => {
          console.warn('Geolocation access denied/failed, falling back to NYC default.', error);
        }
      );
    }
  }, []);

  // Debounced viewport change triggers parent fetching
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleMapMove = (evt?: any) => {
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
      onViewportChange([minLng, minLat, maxLng, maxLat]);
    }, 400); // 400ms debounce
  };

  // Run initial fetch when map is loaded
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      handleMapMove();
    }
  }, [mapLoaded]);

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
    if (!mapRef.current || viewMode === 'heatmap') return [];
    try {
      const map = mapRef.current.getMap();
      const bounds = map.getBounds();
      if (!bounds) return [];
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      return superclusterIndex.getClusters(bbox, Math.round(viewState.zoom));
    } catch (e) {
      return [];
    }
  }, [superclusterIndex, viewState.zoom, viewState.longitude, viewState.latitude, viewMode]);

  // Handle map click
  const handleMapClick = (e: any) => {
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
    } catch (err) {
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
        cursor={isPinDropMode ? 'crosshair' : 'grab'}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />

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
            const { cluster: isCluster, point_count: pointCount, reportId, report } = cluster.properties;

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

        {/* Segmented Map Style Switcher (Street vs Satellite) */}
        <div className="flex border-2 border-black bg-white shadow-brutal-sm pointer-events-auto">
          <button
            onClick={() => setMapStyleName('streets')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-tight transition-all border-r border-black cursor-pointer ${
              mapStyleName === 'streets' ? 'bg-[#0047FF] text-white' : 'bg-white hover:bg-zinc-100 text-[#0A0A0A]'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Street
          </button>
          <button
            onClick={() => setMapStyleName('satellite')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-tight transition-all cursor-pointer ${
              mapStyleName === 'satellite' ? 'bg-[#FF5500] text-white' : 'bg-white hover:bg-zinc-100 text-[#0A0A0A]'
            }`}
          >
            <LayersIcon className="h-3.5 w-3.5" />
            Satellite
          </button>
        </div>
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
    </div>
  );
}
