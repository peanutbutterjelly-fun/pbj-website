// What a guest pays for one ticket: the host's price plus the GST they chose (e.g. "9% CGST + 9% SGST" counts as 18%).
const rate = (g) => ((g || "").match(/\d+(\.\d+)?(?=%)/g) || []).reduce((a, n) => a + parseFloat(n), 0) / 100;
export const guestPays = (t) => (t && t.paid ? (Number(t.price) || 0) * (1 + rate(t.gst)) : 0);
export const rupees = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
// true when this ticket has GST on top of its price
export const hasGst = (t) => !!(t && t.paid && rate(t.gst) > 0);
