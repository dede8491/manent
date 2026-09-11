import React from 'react';
import { Redirect } from 'expo-router';

// Fusionné dans le centre de notifications (app/inbox.tsx). Route conservée pour les anciens liens et notifications.
export default function InvitationsRedirect() {
  return <Redirect href={{ pathname: '/inbox', params: { tab: 'invitations' } }} />;
}
