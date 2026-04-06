export function formatINR(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}
