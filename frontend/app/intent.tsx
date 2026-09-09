import React from 'react';
import { Redirect } from 'expo-router';

// « Je cherche un livre qui… » est le mode « Envie » de la recherche (app/search.tsx). Route conservée pour les anciens liens.
export default function IntentRedirect() {
  return <Redirect href={{ pathname: '/search', params: { mode: 'envie' } }} />;
}
