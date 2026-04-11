// src/core/utils.js — £PER v14 Utilities (v26)

export function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function round(value, dp = 0) {
  if (value == null || isNaN(value)) return null;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}