import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

// Lien universel /b/{catalog_id} → fiche catalogue unique, qui charge le livre par son identifiant.
export default function BookLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/discover/book', params: { catalog_id: String(id || '') } }} />;
}
