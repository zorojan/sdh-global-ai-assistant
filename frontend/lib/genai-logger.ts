// No-op logger (debugging disabled).
export function log(type: string, message: any) {
  // intentionally noop
}

export function logRaw(obj: any) {
  // intentionally noop
}

export default { log, logRaw };
