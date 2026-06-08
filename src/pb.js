import PocketBase from 'pocketbase';

// Determine the URL dynamically: if running locally via vite, connect to localhost:8090.
// If served by PocketBase, use the window.location.origin.
const pbUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8090'
  : window.location.origin;

export const pb = new PocketBase(pbUrl);

// Authentication helper
export const isUserLoggedIn = () => pb.authStore.isValid;
export const logoutUser = () => pb.authStore.clear();
export const getCurrentUser = () => pb.authStore.model;
