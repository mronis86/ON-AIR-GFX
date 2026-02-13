import QRCode from 'qrcode';

/**
 * Generates a QR code data URL from a URL string
 * @param url - The URL to encode in the QR code
 * @returns Promise resolving to a data URL (base64 image)
 */
export const generateQRCode = async (url: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
    });
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};





