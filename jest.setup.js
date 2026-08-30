// Le stockage natif n'existe pas sous Jest : on utilise le mock officiel.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Les polices Google ne sont pas chargées en test ; `useAppFonts` renvoie true.
jest.mock('@expo-google-fonts/fraunces', () => ({
  useFonts: () => [true, null],
  Fraunces_400Regular_Italic: 'Fraunces_400Regular_Italic',
  Fraunces_600SemiBold: 'Fraunces_600SemiBold',
  Fraunces_900Black: 'Fraunces_900Black',
}));

jest.mock('@expo-google-fonts/public-sans', () => ({
  PublicSans_400Regular: 'PublicSans_400Regular',
  PublicSans_500Medium: 'PublicSans_500Medium',
  PublicSans_700Bold: 'PublicSans_700Bold',
}));

// Modules natifs sans implémentation JS exploitable sous Jest.
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  saveToLibraryAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn().mockResolvedValue('file:///tmp/quote-card.png'),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    async base64() {
      return 'YmFzZTY0';
    }
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
  },
  Paths: { cache: '/tmp' },
}));
