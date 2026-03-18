
export const testParcelninjaConnection = async (appContext: 'levis' | 'bounty' | 'admin' = 'admin'): Promise<{ success: boolean; message: string; details?: any }> => {
    try {
        const response = await fetch(`/api/parcelninja/test-connection?appContext=${appContext}`);
        let data;
        const text = await response.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            return { success: false, message: `Server error (${response.status}): ${response.statusText}`, details: text.substring(0, 500) };
        }
        if (!response.ok) {
            return { success: false, message: data.message || 'Failed to connect to Parcelninja API', details: data.details };
        }
        return data;
    } catch (error: any) {
        return { success: false, message: error.message || 'Network failure connecting to Parcelninja API' };
    }
};
