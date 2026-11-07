import type { ReplacedOrderProductImage } from "../contracts";
import type { OrderItemMutationStore, OrderMutationRuntime } from "./ports/order-mutations";
import type { ProductImageStorage } from "./ports/order-images";
export async function replaceOrderProductImage<Image>({ store, storage, orderId, itemId, image, runtime }: {
    store: OrderItemMutationStore;
    storage: ProductImageStorage<Image>;
    orderId: string;
    itemId: string;
    image: Image;
    runtime: OrderMutationRuntime;
}): Promise<ReplacedOrderProductImage | undefined> {
    const snapshot = await store.readItems();
    const target = snapshot.findActive(orderId, itemId);
    if (!target)
        return undefined;
    const uploaded = await storage.upload(image);
    if (!uploaded.webViewLink?.trim())
        throw new Error("Google Drive returned no image URL.");
    const updatedAt = runtime.now();
    await store.writeItemChanges(() => [{ target, field: 'imageUrl', value: uploaded.webViewLink }, { target, field: 'updatedAt', value: updatedAt }]);
    return { id: itemId, imageUrl: uploaded.webViewLink, updatedAt };
}
