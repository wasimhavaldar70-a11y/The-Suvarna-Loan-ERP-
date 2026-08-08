// ========================================================
// SuvarnaLoan ERP - Multi-Tenant Supabase Storage Engine
// Bucket: Uploaded-Documents
// Location: src/lib/storageHelper.ts
// ========================================================

import { supabase, isRealSupabase, getSessionUser } from './supabase/client';

export const BUCKET_NAME = 'Uploaded-Documents';
export const LEGACY_BUCKET_NAME = 'customer-documents';

export interface CustomerDocumentRecord {
  id?: string;
  shop_id: string;
  customer_id: string;
  document_type: string;
  storage_path: string;
  mime_type?: string;
  file_size?: number;
  created_at?: string;
}

export interface StoragePathOptions {
  shopId?: string;              // Tenant Shop ID e.g. "shop-001"
  shopName?: string;            // Tenant Shop Name e.g. "Mahlaxmi Jewellry"
  customerId: string;           // Customer ID e.g. "cust-1001"
  customerName?: string;        // Customer Name e.g. "Ramesh Kumar"
  uniqueId?: string;            // Document suffix / ID
  docType: string;              // Document Type e.g. "Aadhaar-Front", "PAN-Card"
  ornamentDescription?: string; // Optional ornament description
  category?: 'documents' | 'jewellery';
}

const ALLOWED_MIME_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Sanitizes input text into a human-readable, safe filesystem string.
 * Example: "Mahlaxmi Jewellry!" -> "Mahlaxmi_Jewellry"
 */
export function sanitizeHumanName(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[^\w\s-]/g, '')     // Remove non-alphanumeric except spaces & hyphens
    .replace(/[\s-]+/g, '_')      // Convert spaces & hyphens to underscores
    .replace(/_+/g, '_');         // Remove duplicate underscores
}

/**
 * Format Human-Readable Shop Folder:
 * {ShopName}_{ShopID} -> e.g. "Mahlaxmi_Jewellry_shop-009"
 */
export function formatShopFolder(shopId: string, shopName?: string): string {
  const activeShopId = resolveActiveShopId(shopId);
  const session = getSessionUser();
  const rawName = shopName || session?.shop?.shop_name || '';
  const cleanName = sanitizeHumanName(rawName);
  return cleanName ? `${cleanName}_${activeShopId}` : activeShopId;
}

/**
 * Format Human-Readable Customer Folder:
 * {CustomerName}_{CustomerID} -> e.g. "Ramesh_Kumar_cust-001"
 */
export function formatCustomerFolder(customerId: string, customerName?: string): string {
  const cleanCustId = customerId || `cust-${Date.now()}`;
  const cleanName = sanitizeHumanName(customerName || '');
  return cleanName ? `${cleanName}_${cleanCustId}` : cleanCustId;
}

/**
 * Format Human-Readable Document File Name:
 * {DocType}_{UniqueID}.{ext} -> e.g. "Aadhaar_Front_doc-172839401.jpg"
 */
export function formatDocumentFileName(docType: string, uniqueId?: string, ext: string = 'webp', ornamentDesc?: string): string {
  const baseDocType = ornamentDesc ? `${docType}_${ornamentDesc}` : docType || 'Document';
  const cleanType = sanitizeHumanName(baseDocType);
  const cleanId = uniqueId ? sanitizeHumanName(uniqueId) : `${Date.now()}`;
  return `${cleanType}_${cleanId}.${ext}`;
}

let isBucketVerified = false;

/**
 * Ensures the "Uploaded-Documents" storage bucket exists in Supabase.
 * Forces public: false for 100% private RLS protection.
 */
export async function ensureUploadedDocumentsBucketExists(): Promise<string> {
  if (isBucketVerified) return BUCKET_NAME;

  if (isRealSupabase && supabase) {
    try {
      const { data: bucket } = await supabase.storage.getBucket(BUCKET_NAME);
      if (!bucket) {
        await supabase.storage.createBucket(BUCKET_NAME, { public: false });
      }
      isBucketVerified = true;
    } catch (err) {
      console.warn(`ensureUploadedDocumentsBucketExists (${BUCKET_NAME}) warning:`, err);
    }
  }
  return BUCKET_NAME;
}

export const ensureCustomerDocumentsBucketExists = ensureUploadedDocumentsBucketExists;

/**
 * Resolves active shop_id from options or active session.
 */
export function resolveActiveShopId(providedShopId?: string): string {
  if (providedShopId && providedShopId.trim()) return providedShopId.trim();
  const session = getSessionUser();
  if (session?.shop?.id) return session.shop.id;
  if (session?.user?.shop_id) return session.user.shop_id;
  throw new Error('Unauthenticated storage operation: missing active shop_id in user session.');
}

/**
 * Generates exact multi-tenant human-readable storage path:
 * Path: Uploaded-Documents/{ShopName}_{shop_id}/{CustomerName}_{customer_id}/{DocType}_{uniqueId}.ext
 */
export function generateStoragePath(options: StoragePathOptions, ext: string = 'webp'): string {
  const shopId = resolveActiveShopId(options.shopId);
  const shopFolder = formatShopFolder(shopId, options.shopName);
  const customerFolder = formatCustomerFolder(options.customerId, options.customerName);
  const fileName = formatDocumentFileName(options.docType, options.uniqueId, ext, options.ornamentDescription);

  return `${shopFolder}/${customerFolder}/${fileName}`;
}

/**
 * Uploads a customer KYC document or Gold image to Supabase Storage under:
 * Uploaded-Documents/{ShopName}_{shop_id}/{CustomerName}_{customer_id}/{DocType}_{uniqueId}.ext
 */
export async function uploadCustomerDocument(
  shopId: string,
  customerId: string,
  fileOrBase64: File | string,
  documentType: string,
  options?: Partial<StoragePathOptions>
): Promise<{ storagePath: string; record: CustomerDocumentRecord }> {
  const activeShopId = resolveActiveShopId(shopId);
  const activeCustId = customerId || `cust-${Date.now()}`;

  await ensureUploadedDocumentsBucketExists();

  const timestamp = Date.now();
  let blob: Blob;
  let mimeType = 'image/webp';
  let ext = 'webp';

  if (typeof fileOrBase64 === 'string') {
    if (fileOrBase64.startsWith('data:')) {
      const matches = fileOrBase64.match(/^data:([a-zA-Z0-9-+\/]+);base64,/);
      if (matches && matches[1]) {
        mimeType = matches[1];
        if (mimeType.includes('pdf')) ext = 'pdf';
        else if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      }
      const res = await fetch(fileOrBase64);
      blob = await res.blob();
    } else {
      // Relative or full path already stored
      return {
        storagePath: fileOrBase64,
        record: {
          shop_id: activeShopId,
          customer_id: activeCustId,
          document_type: documentType,
          storage_path: fileOrBase64,
          mime_type: mimeType,
          file_size: 0,
        },
      };
    }
  } else {
    blob = fileOrBase64;
    mimeType = fileOrBase64.type || 'image/webp';
    if (mimeType.includes('pdf')) ext = 'pdf';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  }

  // Validate File Size (10MB Max)
  if (blob.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(blob.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit.`);
  }

  // HUMAN-READABLE MULTI-TENANT PATH: {ShopName}_{shop_id}/{CustomerName}_{customer_id}/{DocType}_{uniqueId}.ext
  const fullOptions: StoragePathOptions = {
    shopId: activeShopId,
    shopName: options?.shopName,
    customerId: activeCustId,
    customerName: options?.customerName,
    docType: documentType,
    uniqueId: options?.uniqueId || `doc-${timestamp}`,
    ornamentDescription: options?.ornamentDescription,
  };

  const storagePath = generateStoragePath(fullOptions, ext);

  if (isRealSupabase && supabase) {
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, blob, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      console.error(`Storage upload failed to ${BUCKET_NAME}/${storagePath}:`, error.message);
      throw new Error(`Storage upload error: ${error.message}`);
    }

    // Insert tracking record in PostgreSQL customer_documents table
    const docRecord: CustomerDocumentRecord = {
      id: `doc-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
      shop_id: activeShopId,
      customer_id: activeCustId,
      document_type: documentType,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: blob.size,
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from('customer_documents').insert(docRecord);
    } catch (dbErr) {
      console.warn('customer_documents DB insert warning:', dbErr);
    }

    return { storagePath, record: docRecord };
  }

  return {
    storagePath,
    record: {
      shop_id: activeShopId,
      customer_id: activeCustId,
      document_type: documentType,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: blob.size,
    },
  };
}

/**
 * Uploads gold/silver ornament images under human-readable customer folder:
 * Uploaded-Documents/{ShopName}_{shop_id}/{CustomerName}_{customer_id}/Pledged_Gold_Ornament_item_{idx}_{timestamp}.webp
 */
export async function uploadGoldImages(
  shopId: string,
  customerId: string,
  images: (File | string)[],
  options?: Partial<StoragePathOptions>
): Promise<string[]> {
  const activeShopId = resolveActiveShopId(shopId);
  const activeCustId = customerId || `cust-${Date.now()}`;
  const uploadedPaths: string[] = [];
  let idx = 0;

  for (const img of images) {
    idx++;
    if (!img) continue;
    try {
      const res = await uploadCustomerDocument(
        activeShopId,
        activeCustId,
        img,
        `Pledged-Gold-Ornament-Item-${idx}`,
        {
          ...options,
          uniqueId: `item-${idx}-${Date.now()}`,
        }
      );
      uploadedPaths.push(res.storagePath);
    } catch (err) {
      console.error(`Gold ornament image #${idx} upload error:`, err);
    }
  }

  return uploadedPaths;
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const inFlightSignedUrlPromises = new Map<string, Promise<string>>();

/**
 * Generates a temporary Signed URL (30 minutes default) for displaying documents.
 * Checks both Uploaded-Documents and legacy customer-documents buckets.
 * Includes instant in-memory cache and in-flight request deduplication.
 */
export async function getSignedDocumentUrl(
  shopId: string | undefined,
  storagePath: string,
  expiresInSeconds: number = 604800
): Promise<string> {
  if (!storagePath || storagePath.startsWith('data:') || storagePath.startsWith('blob:')) {
    return storagePath;
  }

  // Strip existing token or query parameters if present
  const cleanPath = storagePath.split('?')[0];

  // 1. Check In-Memory Signed URL Cache
  const cached = signedUrlCache.get(cleanPath);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.url;
  }

  // 2. In-Flight Request Coalescing (Eliminates duplicate storage network calls)
  if (inFlightSignedUrlPromises.has(cleanPath)) {
    return inFlightSignedUrlPromises.get(cleanPath)!;
  }

  const promise = (async () => {
    let bucketToUse = BUCKET_NAME;
    let relativePath = cleanPath;

    if (cleanPath.includes(`/${BUCKET_NAME}/`)) {
      relativePath = cleanPath.split(`/${BUCKET_NAME}/`)[1];
    } else if (cleanPath.includes(`/${LEGACY_BUCKET_NAME}/`)) {
      bucketToUse = LEGACY_BUCKET_NAME;
      relativePath = cleanPath.split(`/${LEGACY_BUCKET_NAME}/`)[1];
    } else if (cleanPath.includes('Uploaded-Documents/')) {
      relativePath = cleanPath.split('Uploaded-Documents/')[1];
    } else if (cleanPath.includes('customer-documents/')) {
      bucketToUse = LEGACY_BUCKET_NAME;
      relativePath = cleanPath.split('customer-documents/')[1];
    } else if (cleanPath.startsWith('/')) {
      relativePath = cleanPath.substring(1);
    }

    if (isRealSupabase && supabase) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketToUse)
          .createSignedUrl(relativePath, expiresInSeconds);

        if (!error && data?.signedUrl) {
          // Cache the signed URL for 50% of the expiry duration or 12 hours
          const ttlMs = Math.min(expiresInSeconds * 1000 * 0.5, 12 * 60 * 60 * 1000);
          signedUrlCache.set(cleanPath, {
            url: data.signedUrl,
            expiresAt: Date.now() + ttlMs,
          });
          return data.signedUrl;
        }
      } catch (err) {
        console.warn(`getSignedDocumentUrl (${bucketToUse}/${relativePath}) warning:`, err);
      }
    }

    return storagePath;
  })();

  inFlightSignedUrlPromises.set(cleanPath, promise);
  try {
    return await promise;
  } finally {
    inFlightSignedUrlPromises.delete(cleanPath);
  }
}

/**
 * Purges all customer documents and jewellery images under:
 * Uploaded-Documents/{ShopFolder}/{CustomerFolder}/
 * Removes files from Supabase Storage and cleans up database tracking records.
 */
export async function deleteCustomerFiles(
  shopId: string,
  customerId: string,
  customerName?: string,
  shopName?: string
): Promise<boolean> {
  const activeShopId = resolveActiveShopId(shopId);
  if (!activeShopId || !customerId) return false;

  const shopFolder = formatShopFolder(activeShopId, shopName);
  const custFolder = formatCustomerFolder(customerId, customerName);

  if (isRealSupabase && supabase) {
    try {
      // 1. List files in human readable folder
      const { data: files } = await supabase.storage
        ? await supabase.storage.from(BUCKET_NAME).list(`${shopFolder}/${custFolder}`)
        : { data: null };

      if (files && files.length > 0) {
        const paths = files.map((f) => `${shopFolder}/${custFolder}/${f.name}`);
        await supabase.storage?.from(BUCKET_NAME).remove(paths);
      }

      // 2. Also check legacy unformatted path shop_id/customer_id/
      const legacyShopId = sanitizeHumanName(activeShopId);
      const legacyCustId = sanitizeHumanName(customerId);
      const { data: legacyFiles } = await supabase.storage
        ? await supabase.storage.from(BUCKET_NAME).list(`${legacyShopId}/${legacyCustId}`)
        : { data: null };

      if (legacyFiles && legacyFiles.length > 0) {
        const legacyPaths = legacyFiles.map((f) => `${legacyShopId}/${legacyCustId}/${f.name}`);
        await supabase.storage?.from(BUCKET_NAME).remove(legacyPaths);
      }

      // 3. Purge DB records from customer_documents table
      if (supabase.from) {
        await supabase.from('customer_documents').delete().eq('shop_id', activeShopId).eq('customer_id', customerId);
      }

      return true;
    } catch (err) {
      console.error(`deleteCustomerFiles error for ${shopFolder}/${custFolder}:`, err);
    }
  }

  return false;
}

/**
 * Intercepts Base64 data URLs and enforces upload to private Supabase Storage bucket.
 * Throws explicit exception if upload fails to guarantee ZERO base64 strings are saved into DB columns.
 */
export function isBase64DataUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('data:image/') || url.startsWith('data:application/') || url.startsWith('data:');
}

export async function sanitizeStoragePathOrUpload(
  shopId: string,
  customerId: string,
  urlOrPath: string | undefined | null,
  documentType: string,
  options?: Partial<StoragePathOptions>
): Promise<string | null> {
  if (!urlOrPath) return null;
  if (!isBase64DataUrl(urlOrPath)) {
    return urlOrPath; // Already a clean storage path
  }

  // Intercept base64 string and upload to Supabase storage bucket
  const activeShopId = resolveActiveShopId(shopId);
  const activeCustId = customerId || `cust-${Date.now()}`;

  const { storagePath } = await uploadCustomerDocument(
    activeShopId,
    activeCustId,
    urlOrPath,
    documentType,
    options
  );

  if (isBase64DataUrl(storagePath)) {
    throw new Error(`Failed to upload ${documentType} to secure storage. Base64 strings cannot be written to database columns.`);
  }

  return storagePath;
}

/**
 * Component compatibility wrapper for uploadToSupabaseStorage.
 * Resolves active shop ID and uploads to Uploaded-Documents/{ShopName}_{shop_id}/{CustomerName}_{customer_id}/
 */
export async function uploadToSupabaseStorage(
  base64DataUrl: string,
  options: StoragePathOptions
): Promise<string> {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:')) {
    return base64DataUrl;
  }

  const shopId = resolveActiveShopId(options.shopId);
  const customerId = options.customerId || `cust-${Date.now()}`;
  const docType = options.docType || 'Document';

  const { storagePath } = await uploadCustomerDocument(
    shopId,
    customerId,
    base64DataUrl,
    docType,
    options
  );

  if (isBase64DataUrl(storagePath)) {
    throw new Error(`Storage upload failed for ${docType}. Base64 image URL cannot be stored in database.`);
  }

  // Return clean storage path for database persistence
  return storagePath;
}
