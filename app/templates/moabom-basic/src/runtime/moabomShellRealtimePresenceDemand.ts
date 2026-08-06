let presenceDemand = false;

export function setMoabomShellPresenceRealtimeDemand(active: boolean): void {
  presenceDemand = active;
}

export function isMoabomShellPresenceRealtimeDemanded(): boolean {
  return presenceDemand;
}

export function resetMoabomShellPresenceRealtimeDemandForTest(): void {
  presenceDemand = false;
}
