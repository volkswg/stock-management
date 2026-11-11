// This proxy is copied into the private test build only. All IO and isolation
// live in the preloaded harness, outside Next's application module graph.
function driver() {
    const state = globalThis[Symbol.for('stock.localWriteHarness')];
    if (!state?.drive)
        throw new Error('Private write-test provider isolation was not installed.');
    return state.drive;
}
class FakeDrive {
    uploadImage(input) {
        return driver().uploadImage(input);
    }
    deleteFile(id) {
        return driver().deleteFile(id);
    }
    makeFileReadableByLink(id) {
        return driver().makeFileReadableByLink(id);
    }
    checkConnection() {
        return driver().checkConnection();
    }
}
module.exports = {
    FakeDrive
};
