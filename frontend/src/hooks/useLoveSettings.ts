import { siteConfig } from "../data/siteConfig";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { useLocalStorage } from "./useLocalStorage";
import { useEffect } from "react";

export type LoveSettings = {
  firstMeetDate: string;
  loveStartDate: string;
  visualEffect: "hearts" | "meteors" | "petals" | "starlight" | "mixed" | "none";
  nicknameMe: string;
  nicknameHer: string;
  avatarMe: string;
  avatarHer: string;
};

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
  useEffect(() => {
    if (storedSettings.nicknameMe === "WLY" && storedSettings.nicknameHer === "LXQ") {
      setStoredSettings((current) => ({ ...current, nicknameMe: "LXQ", nicknameHer: "WLY" }));
    }
  }, [setStoredSettings, storedSettings.nicknameHer, storedSettings.nicknameMe]);
  return [{ ...defaultSettings, ...storedSettings }, setStoredSettings] as const;
}
