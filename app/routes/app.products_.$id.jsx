import React from "react";
import { useLoaderData, useNavigate, useFetcher, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";

// ── LOADER ──────────────────────────────────────────────────────────
export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(
    `#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        descriptionHtml
        status
        totalInventory
        createdAt
        updatedAt
        featuredImage { url altText }
        images(first: 5) {
          edges { node { url altText } }
        }
        variants(first: 20) {
          edges {
            node {
              id
              title
              price
              compareAtPrice
              availableForSale
              inventoryQuantity
              sku
            }
          }
        }
        tags
        vendor
        productType
      }
    }`,
    { variables: { id: productId } }
  );

  const data = await response.json();
  return { product: data.data.product };
};

// ── ACTION — Update product ──────────────────────────────────────────
export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update") {
    const response = await admin.graphql(
      `#graphql
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id title status }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: productId,
            title: formData.get("title"),
            status: formData.get("status"),
            vendor: formData.get("vendor"),
            productType: formData.get("productType"),
            tags: formData.get("tags"),
          },
        },
      }
    );
    const data = await response.json();
    const errors = data.data.productUpdate.userErrors;
    if (errors.length > 0) return { success: false, errors };
    return { success: true, intent: "update" };
  }

  if (intent === "delete") {
    await admin.graphql(
      `#graphql
      mutation deleteProduct($id: ID!) {
        productDelete(input: { id: $id }) {
          deletedProductId
        }
      }`,
      { variables: { id: productId } }
    );
    return { success: true, intent: "delete" };
  }

  return { success: false };
};

// ── Field component ──────────────────────────────────────────────────
function Field({ label, value, name, type = "text", readOnly = false, options }) {
  const style = {
    width: "100%", padding: "9px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827",
    background: readOnly ? "#f9fafb" : "#fff",
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{label}</label>
      {options ? (
        <select name={name} defaultValue={value} style={style} disabled={readOnly}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} name={name} defaultValue={value} readOnly={readOnly} style={style} />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { product } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [searchParams] = useSearchParams();
  const [editMode, setEditMode] = React.useState(searchParams.get("mode") === "edit");

  const variants = product.variants.edges.map((e) => e.node);
  const images = product.images.edges.map((e) => e.node);
  const isActive = product.status === "ACTIVE";
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "update";
  const isDeleting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "delete";

  // Toast feedback
  React.useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.intent === "update") {
        shopify.toast.show("Product updated ✓");
        setEditMode(false);
      }
      if (fetcher.data.intent === "delete") {
        shopify.toast.show("Product deleted ✓");
        navigate("/app/products");
      }
    }
  }, [fetcher.data]);

  const handleDelete = () => {
    if (confirm(`"${product.title}" Product Will Delete permanently`)) {
      const fd = new FormData();
      fd.append("intent", "delete");
      fetcher.submit(fd, { method: "POST" });
    }
  };

  const cardStyle = {
    background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: "12px", padding: "20px", marginBottom: "16px",
  };

  return (
    <s-page heading={editMode ? "Edit Product" : "Product Details"}>

      {/* Top action bar */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => navigate("/app/products")} style={{
          padding: "8px 14px", borderRadius: "8px", border: "1px solid #e5e7eb",
          background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
        }}>← Back to Products</button>

        <div style={{ display: "flex", gap: "8px" }}>
          {!editMode && (
            <button
              onClick={() => {
                shopify.intents.invoke?.("edit:shopify/Product", {
                  value: product.id,
                });
              }}
              style={{
                padding: "8px 16px", borderRadius: "8px", border: "1px solid #6366f1",
                background: "#fff", fontSize: "13px", fontWeight: "500",
                cursor: "pointer", color: "#6366f1",
              }}
            >
              ✏️ Edit in Shopify
            </button>
          )}
          {editMode && (
            <button onClick={() => setEditMode(false)} style={{
              padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e7eb",
              background: "#fff", fontSize: "13px", cursor: "pointer", color: "#374151",
            }}>Cancel</button>
          )}
          <button onClick={handleDelete} disabled={isDeleting} style={{
            padding: "8px 16px", borderRadius: "8px", border: "1px solid #fca5a5",
            background: "#fff5f5", fontSize: "13px", fontWeight: "500",
            cursor: "pointer", color: "#dc2626",
            opacity: isDeleting ? 0.6 : 1,
          }}>
            {isDeleting ? "Deleting..." : "🗑️ Delete"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px" }}>

        {/* Left column */}
        <div>
          {/* Main info card */}
          <fetcher.Form method="POST">
            <input type="hidden" name="intent" value="update" />
            <div style={cardStyle}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827", marginBottom: "16px" }}>
                📋 Product Info
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <Field label="Title" name="title" value={product.title} readOnly={!editMode} />
                <Field label="Vendor" name="vendor" value={product.vendor || ""} readOnly={!editMode} />
                <Field label="Product Type" name="productType" value={product.productType || ""} readOnly={!editMode} />
                <Field label="Tags (comma separated)" name="tags" value={product.tags?.join(", ") || ""} readOnly={!editMode} />
                <Field label="Status" name="status" value={product.status} readOnly={!editMode}
                  options={editMode ? [
                    { value: "ACTIVE", label: "Active" },
                    { value: "DRAFT", label: "Draft" },
                    { value: "ARCHIVED", label: "Archived" },
                  ] : null}
                />
              </div>

              {editMode && (
                <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" disabled={isSaving} style={{
                    padding: "10px 24px", borderRadius: "8px", border: "none",
                    background: isSaving ? "#a5b4fc" : "#6366f1", color: "#fff",
                    fontSize: "13px", fontWeight: "600", cursor: "pointer",
                  }}>
                    {isSaving ? "Saving..." : "💾 Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </fetcher.Form>

          {/* Variants table */}
          <div style={cardStyle}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827", marginBottom: "16px" }}>
              🎨 Variants ({variants.length})
            </div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 100px 80px 80px", padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {["Variant", "Price", "Compare", "Stock", "Status"].map((h) => (
                  <span key={h} style={{ fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform: "uppercase" }}>{h}</span>
                ))}
              </div>
              {variants.map((v, i) => (
                <div key={v.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 90px 100px 80px 80px",
                  padding: "10px 14px", alignItems: "center",
                  borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                  background: v.availableForSale ? "#fff" : "#fff5f5",
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "500", color: "#111827" }}>{v.title}</div>
                    {v.sku && <div style={{ fontSize: "11px", color: "#9ca3af" }}>SKU: {v.sku}</div>}
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>${parseFloat(v.price).toFixed(2)}</span>
                  <span>
                    {v.compareAtPrice
                      ? <s style={{ fontSize: "12px", color: "#9ca3af" }}>${parseFloat(v.compareAtPrice).toFixed(2)}</s>
                      : <span style={{ color: "#d1d5db" }}>—</span>}
                  </span>
                  <span style={{ fontSize: "13px", color: (v.inventoryQuantity || 0) < 3 ? "#ef4444" : "#374151", fontWeight: "600" }}>
                    {v.inventoryQuantity ?? 0}
                  </span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "500", width: "fit-content",
                    background: v.availableForSale ? "#d1fae5" : "#fee2e2",
                    color: v.availableForSale ? "#065f46" : "#991b1b",
                  }}>
                    {v.availableForSale ? "In stock" : "Out"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Featured image */}
          <div style={cardStyle}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827", marginBottom: "12px" }}>🖼️ Images</div>
            {product.featuredImage ? (
              <img src={product.featuredImage.url} alt={product.title}
                style={{ width: "100%", borderRadius: "8px", objectFit: "cover", maxHeight: "200px" }} />
            ) : (
              <div style={{ width: "100%", height: "150px", background: "#f3f4f6", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>🛍️</div>
            )}
            {images.length > 1 && (
              <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                {images.slice(1).map((img, i) => (
                  <img key={i} src={img.url} alt={img.altText || product.title}
                    style={{ width: "56px", height: "56px", borderRadius: "6px", objectFit: "cover", border: "1px solid #e5e7eb" }} />
                ))}
              </div>
            )}
          </div>

          {/* Summary card */}
          <div style={cardStyle}>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#111827", marginBottom: "14px" }}>📊 Summary</div>
            {[
              { label: "Status", value: product.status, badge: true, active: isActive },
              { label: "Total Inventory", value: `${product.totalInventory} units` },
              { label: "Variants", value: `${variants.length} total` },
              { label: "In Stock", value: `${variants.filter((v) => v.availableForSale).length} variants` },
              { label: "Out of Stock", value: `${variants.filter((v) => !v.availableForSale).length} variants` },
              { label: "Created", value: new Date(product.createdAt).toLocaleDateString() },
              { label: "Updated", value: new Date(product.updatedAt).toLocaleDateString() },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: "12px", color: "#6b7280" }}>{row.label}</span>
                {row.badge ? (
                  <span style={{
                    fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "12px",
                    background: row.active ? "#d1fae5" : "#f3f4f6",
                    color: row.active ? "#065f46" : "#6b7280",
                  }}>{row.value}</span>
                ) : (
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#111827" }}>{row.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </s-page>
  );
}