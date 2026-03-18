
import { format } from 'date-fns';



export const uploadHtmlReport = async (htmlContent: string, groupName: string): Promise<{ url: string; fileName: string }> => {
    const cleanGroupName = groupName.replace(/\s+/g, '_');
    const dateStr = format(new Date(), 'yyyyMMdd');
    const finalFileName = `Report_${cleanGroupName}_${dateStr}.html`;

    const formData = new FormData();
    formData.append('report', new Blob([htmlContent], { type: 'text/html' }), finalFileName);

    try {
        const response = await fetch('/api/storage/upload-report', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Storage] Upload failed with status ${response.status}. Body:`, errorBody);
            throw new Error(`Upload failed: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error("[Storage] Upload failed:", error);
        if (error instanceof SyntaxError) {
             console.error("[Storage] JSON Parse Error. Response might be HTML.");
        }
        throw new Error(`Report upload failed: ${error.message}`);
    }
};

export const downloadHtmlReport = async (fileName: string): Promise<string> => {
    try {
        const response = await fetch(`/api/storage/download-report/${encodeURIComponent(fileName)}`);

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Download failed: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        return data.url;
    } catch (error: any) {
        console.error("[Storage] Download failed:", error);
        throw new Error(`Report download failed: ${error.message}`);
    }
};
