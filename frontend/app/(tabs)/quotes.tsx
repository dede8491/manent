import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

// Les citations vivent dans l'onglet Journal (segment « Citations »). Cette route reste pour les anciens liens.
export default function QuotesRedirect() {
  const { book_id } = useLocalSearchParams<{ book_id?: string }>();
  return <Redirect href={{ pathname: '/(tabs)/journal', params: { segment: 'citations', ...(book_id ? { book_id } : {}) } }} />;
}
