import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { fonts, radius, spacing } from '@/src/theme';
import { useColors, useStyles } from '@/src/themeCtx';
import { useT } from '@/src/i18n';

export default function DiscoverScan() {
  const t = useT();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualIsbn, setManualIsbn] = useState('');
  const scannedRef = useRef(false);
  const isWeb = Platform.OS === 'web';

  const go = (isbn: string) => {
    const code = isbn.replace(/[^0-9Xx]/g, '');
    if (code.length < 10) return;
    router.replace({ pathname: '/discover/[isbn]', params: { isbn: code } });
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    go(data);
  };

  const canScan = !isWeb && permission?.granted;

  return (
    <View style={{ flex: 1, backgroundColor: colors.espresso }} testID="screen-discover-scan">
      {canScan ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          onBarcodeScanned={onBarcode}
        />
      ) : null}
      <View style={[styles.band, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.help}>{t('Vise le code-barres au dos du livre')}</Text>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.xl }]}>
        {isWeb && (
          <Text style={styles.webNote} testID="scan-web-note">{t('Le scan du code-barres fonctionne dans l’app installée (TestFlight ou store). Dans cet aperçu web, saisis l’ISBN ci-dessous.')}</Text>
        )}
        {!isWeb && !permission?.granted && (
          <>
            <Text style={styles.webNote}>{permission?.canAskAgain === false ? t('Caméra refusée : autorise Manent dans les réglages de ton téléphone, ou saisis l’ISBN.') : t('Manent a besoin de la caméra pour lire le code-barres.')}</Text>
            <Pressable testID="scan-permission" onPress={requestPermission} style={styles.permBtn}>
              <Text style={styles.permBtnText}>{t('Autoriser la caméra')}</Text>
            </Pressable>
          </>
        )}
        <View style={styles.manualRow}>
          <TextInput
            testID="discover-isbn-input"
            value={manualIsbn}
            onChangeText={setManualIsbn}
            keyboardType="number-pad"
            placeholder={t('Ou saisis l’ISBN…')}
            placeholderTextColor={colors.clay}
            style={styles.manualInput}
            onSubmitEditing={() => go(manualIsbn)}
          />
          <Pressable testID="discover-isbn-go" onPress={() => go(manualIsbn)} style={styles.goBtn}>
            <Feather name="arrow-right" size={18} color={colors.creme} />
          </Pressable>
        </View>
        <Pressable testID="scan-close" onPress={() => router.back()} style={{ alignSelf: 'center', marginTop: spacing.md, padding: spacing.sm }}>
          <Text style={styles.closeText}>{t('Annuler')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  band: { alignItems: 'center', paddingHorizontal: spacing.xl },
  webNote: { fontFamily: fonts.body, fontSize: 13, color: colors.creme, textAlign: 'center', lineHeight: 18, marginBottom: spacing.md, opacity: 0.9 },
  help: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.creme, backgroundColor: 'rgba(58,33,25,0.65)', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, overflow: 'hidden' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.xl },
  permBtn: { height: 46, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  permBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.creme },
  manualRow: { flexDirection: 'row', gap: spacing.sm },
  manualInput: { flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.creme, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15, color: colors.espresso },
  goBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.chambray, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.bisque },
});
