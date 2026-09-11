import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

// Le résultat d'un scan s'affiche dans la fiche catalogue unique (app/discover/book.tsx). Route conservée pour les anciens liens.
export default function IsbnRedirect() {
  const { isbn } = useLocalSearchParams<{ isbn: string }>();
  return <Redirect href={{ pathname: '/discover/book', params: { isbn: String(isbn || '') } }} />;
}
