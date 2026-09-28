import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import "@fontsource-variable/inter";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import App from './App.tsx';
import './index.css';

console.log("MAIN: main.tsx is starting execution...");

const container = document.getElementById('root');
console.log("MAIN: Root container found:", !!container);

createRoot(container!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
console.log("MAIN: createRoot render called!");

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("[pwa] service worker registration failed", error);
    });
  });
}

