function active() {
  const state = globalThis[Symbol.for('stock.hostedWriteHarness')];
  if (!state?.drive) throw new Error('Private hosted test isolation is required.');
  return state.drive;
}
class HostedFakeDrive {
  uploadImage(input) { return active().uploadImage(input); }
  deleteFile(id) { return active().deleteFile(id); }
  makeFileReadableByLink(id) { return active().makeFileReadableByLink(id); }
  checkConnection() { return active().checkConnection(); }
}
module.exports = { HostedFakeDrive };
