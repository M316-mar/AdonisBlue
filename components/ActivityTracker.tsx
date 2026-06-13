"use client";

/**
 * ActivityTracker — resets the sb_last_active inactivity cookie on every user
 * interaction so the 30-minute server-side timeout only fires after genuine
 * inactivity (no clicks, keystrokes, scrolls, or touch events).
 *
 * The cookie write is debounced to at most once every 60 seconds so we are
 * not thrashing storage on rapid mouse moves.
 *
 * Mount this once at the root layout level. It renders nothing to the DOM.
 */

import { useEffect } from "react";

const COOKIE_NAME = "sb_last_active";
const DEBOUNCE_MS = 60_000; // write at most once per minute
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 h — inactivity check enforces 30-min window

const EVENTS = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "scroll",
  "touchstart",
  "touchmove",
  "wheel",
] as const;

function setLastActiveCookie() {
  const isSecure = window.location.protocol === "https:";
  const secure = isSecure ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${Date.now()}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export default function ActivityTracker() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastWrite = 0;

    function handleActivity() {
      const now = Date.now();

      // If enough time has passed since the last write, write immediately
      // and reset the debounce window.
      if (now - lastWrite >= DEBOUNCE_MS) {
        lastWrite = now;
        setLastActiveCookie();
        return;
      }

      // Otherwise schedule a write for when the debounce window expires,
      // replacing any already-pending timer (so rapid events don't pile up).
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        lastWrite = Date.now();
        setLastActiveCookie();
        timer = null;
      }, DEBOUNCE_MS - (now - lastWrite));
    }

    // Passive listeners — won't block scrolling or touch gestures
    const options: AddEventListenerOptions = { passive: true, capture: true };
    EVENTS.forEach((evt) => window.addEventListener(evt, handleActivity, options));

    // Write once immediately so the cookie is present right when the component mounts
    setLastActiveCookie();
    lastWrite = Date.now();

    return () => {
      if (timer !== null) clearTimeout(timer);
      EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity, options));
    };
  }, []);

  // Renders nothing — pure side-effect component
  return null;
}
