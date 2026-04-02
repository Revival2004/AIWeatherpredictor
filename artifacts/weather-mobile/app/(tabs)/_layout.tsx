import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

// Accent colours for each tab — visually distinct, farmer-friendly
const TAB_COLORS = {
  dashboard: "#F59E0B",  // amber/yellow  — cloud/weather
  forecast:  "#3B82F6",  // blue           — forecast/calendar
  history:   "#8B5CF6",  // purple         — history/clock
  analytics: "#3D8B37",  // leaf green     — analytics/growth
};

interface TabIconProps {
  name: keyof typeof Feather.glyphMap;
  focused: boolean;
  accentColor: string;
}

function TabIcon({ name, focused, accentColor }: TabIconProps) {
  return (
    <View
      style={{
        width: 44,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? `${accentColor}22` : "transparent",
      }}
    >
      <Feather
        name={name}
        size={22}
        color={focused ? accentColor : "#9CA3AF"}
      />
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";
  const insets = useSafeAreaInsets();

  // On Android the system gesture/nav bar sits at the bottom.
  // We add its height as paddingBottom so the tab bar clears it completely.
  const androidBottomPad = isAndroid ? Math.max(insets.bottom, 8) : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          ...(isAndroid ? {} : { position: "absolute" }),
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: isAndroid ? 12 : 0,
          shadowOpacity: 0,
          // Grow the tab bar to include the system nav area
          paddingBottom: androidBottomPad,
          height: isAndroid ? 60 + androidBottomPad : undefined,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_500Medium",
          marginTop: 1,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.background,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                },
              ]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarActiveTintColor: TAB_COLORS.dashboard,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="cloud" focused={focused} accentColor={TAB_COLORS.dashboard} />
          ),
        }}
      />
      <Tabs.Screen
        name="forecast"
        options={{
          title: "Forecast",
          tabBarActiveTintColor: TAB_COLORS.forecast,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="calendar" focused={focused} accentColor={TAB_COLORS.forecast} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarActiveTintColor: TAB_COLORS.history,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="clock" focused={focused} accentColor={TAB_COLORS.history} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Analytics",
          tabBarActiveTintColor: TAB_COLORS.analytics,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart-2" focused={focused} accentColor={TAB_COLORS.analytics} />
          ),
        }}
      />
    </Tabs>
  );
}
