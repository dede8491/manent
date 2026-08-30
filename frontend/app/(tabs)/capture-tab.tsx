// Stub screen — actual capture opens as a modal via the elevated tab button.
// This file exists so expo-router registers the tab.
import { Redirect } from 'expo-router';
export default function CaptureTab() {
  return <Redirect href="/(tabs)/home" />;
}
