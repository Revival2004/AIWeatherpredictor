import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

interface PickedLocation {
  latitude: number;
  longitude: number;
  name: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (loc: PickedLocation) => void;
}

function buildMapHtml(copy: { hint: string; lookup: string }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    #hint {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: #fff;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-family: sans-serif;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
    }
    .farm-pin {
      background: #3D8B37;
      width: 22px;
      height: 22px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    }
  </style>
</head>
<body>
<div id="map"></div>
<div id="hint">${copy.hint}</div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([0.2, 37.9], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  var marker = null;
  var farmIcon = L.divIcon({ className: '', html: '<div class="farm-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });

  function updateLocation(lat, lon) {
    document.getElementById('hint').textContent = '${copy.lookup}';

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', lat: lat, lon: lon }));

    fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&zoom=14&addressdetails=1', {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'FarmPalApp/1.0' }
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      var parts = [];
      var a = data.address || {};
      if (a.village || a.town || a.city || a.suburb) parts.push(a.village || a.town || a.city || a.suburb);
      if (a.county || a.state_district) parts.push(a.county || a.state_district);
      if (a.state) parts.push(a.state);
      var name = parts.join(', ') || data.display_name || (lat.toFixed(4) + ', ' + lon.toFixed(4));
      document.getElementById('hint').textContent = name;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'name', name: name }));
    })
    .catch(function(){
      var fallback = lat.toFixed(4) + '\u00b0, ' + lon.toFixed(4) + '\u00b0';
      document.getElementById('hint').textContent = fallback;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'name', name: fallback }));
    });
  }

  map.on('click', function(e) {
    var lat = e.latlng.lat;
    var lon = e.latlng.lng;

    if (marker) { marker.remove(); }
    marker = L.marker([lat, lon], { icon: farmIcon, draggable: true }).addTo(map);
    marker.on('dragend', function(event) {
      var position = event.target.getLatLng();
      updateLocation(position.lat, position.lng);
    });

    updateLocation(lat, lon);
  });
</script>
</body>
</html>`;
}

export default function MapLocationPicker({ visible, onClose, onConfirm }: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const [pinned, setPinned] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const mapHtml = buildMapHtml({
    hint: t("mapAdjustHint"),
    lookup: t("lookingUp"),
  });

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "pin") {
        setPinned({ lat: msg.lat, lon: msg.lon, name: t("lookingUp") });
      } else if (msg.type === "name") {
        setPinned((prev) => prev ? { ...prev, name: msg.name } : null);
      }
    } catch {}
  }

  function handleConfirm() {
    if (!pinned) return;
    onConfirm({ latitude: pinned.lat, longitude: pinned.lon, name: pinned.name });
    setPinned(null);
    onClose();
  }

  function handleClose() {
    setPinned(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>{`X ${t("cancel")}`}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("pinFarm")}</Text>
          <View style={{ width: 80 }} />
        </View>

        <View style={styles.mapWrap}>
          {loading && (
            <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.mutedForeground, marginTop: 10, fontSize: 13 }}>{t("loadingMap")}</Text>
            </View>
          )}
          <WebView
            source={{ html: mapHtml }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            mixedContentMode="always"
            allowFileAccess
            geolocationEnabled={false}
          />
        </View>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {pinned ? (
            <>
              <View style={styles.pinnedInfo}>
                <Text style={[styles.pinnedIcon]}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pinnedName, { color: colors.foreground }]} numberOfLines={2}>
                    {pinned.name}
                  </Text>
                  <Text style={[styles.pinnedCoords, { color: colors.mutedForeground }]}>
                    {pinned.lat.toFixed(5)}°, {pinned.lon.toFixed(5)}°
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#3D8B37" }]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmText}>{t("useLocation")}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.footerHint, { color: colors.mutedForeground }]}>
              {t("mapAdjustHint")}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 80 },
  title: { fontSize: 17, fontWeight: "600" },
  mapWrap: { flex: 1, position: "relative" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    minHeight: 100,
    justifyContent: "center",
  },
  footerHint: {
    textAlign: "center",
    fontSize: 14,
  },
  pinnedInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 10,
  },
  pinnedIcon: { fontSize: 22, marginTop: 2 },
  pinnedName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  pinnedCoords: { fontSize: 12 },
  confirmBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
