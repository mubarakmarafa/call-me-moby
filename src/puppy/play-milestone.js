export function createPlayMilestone(onReached, threshold = 6) {
  let count = 0, lastSerial = 0, reached = false;
  return serial => {
    if (!Number.isFinite(serial) || serial <= lastSerial) return;
    count += serial - lastSerial;
    lastSerial = serial;
    if (!reached && count >= threshold) {
      reached = true;
      onReached();
    }
  };
}
