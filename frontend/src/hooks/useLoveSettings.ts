import { Dispatch, SetStateAction, useCallback, useEffect, useMemo } from "react";
import { api } from "../api/client";
import { siteConfig } from "../data/siteConfig";
import type { LoveSettings } from "../types";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { useLocalStorage } from "./useLocalStorage";

const defaultSettings: LoveSettings = {
  firstMeetDate: siteConfig.firstMeetDate,
  loveStartDate: siteConfig.loveStartDate,
  visualEffect: "mixed",
  nicknameMe: "LXQ",
  nicknameHer: "WLY",
  avatarMe: "",
  avatarHer: ""
};

export function useLoveSettings() {
  const [storedSettings, setStoredSettings] = useLocalStorage<LoveSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
  const settings = useMemo(() => ({ ...defaultSettings, ...storedSettings }), [storedSettings]);

  useEffect(() => {
    let alive = true;
    api.settings.love.get()
      .then((remote) => {
        if (alive) setStoredSettings({ ...defaultSettings, ...remote });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [setStoredSettings]);

  const setSettings = useCallback<Dispatch<SetStateAction<LoveSettings>>>((action) => {
    setStoredSettings((current) => {
      const merged = { ...defaultSettings, ...current };
      const next = typeof action === "function" ? action(merged) : action;
      const normalized = { ...merged, ...next };
      window.setTimeout(() => {
        void api.settings.love.update(normalized).catch(() => undefined);
      }, 0);
      return normalized;
    });
  }, [setStoredSettings]);

  useEffect(() => {
    if (settings.nicknameMe === "WLY" && settings.nicknameHer === "LXQ") {
      setSettings((current) => ({ ...current, nicknameMe: "LXQ", nicknameHer: "WLY" }));
    }
  }, [setSettings, settings.nicknameHer, settings.nicknameMe]);

  return [settings, setSettings] as const;
}
