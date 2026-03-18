
import React, { useState } from 'react';
import { X, Copy, ExternalLink, Check } from 'lucide-react';

type LinkResultModalProps = {
    isOpen: boolean;
    onClose: () => void;
    url: string;
}

export const LinkResultModal: React.FC<LinkResultModalProps> = ({ isOpen, onClose, url }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <ExternalLink size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Report Link Generated!</h3>
                    <p className="text-sm text-slate-500 mb-6">Your executive synopsis has been securely uploaded and is ready to share.</p>
                    
                    <div className="bg-slate-100 p-3 rounded-lg flex items-center gap-2 mb-6 border border-slate-200">
                        <input 
                            type="text" 
                            readOnly 
                            value={url} 
                            className="bg-transparent border-none text-xs text-slate-600 w-full focus:ring-0"
                        />
                        <button onClick={handleCopy} className="text-slate-400 hover:text-blue-600 transition-colors" title="Copy to clipboard">
                            {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                        </button>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
                            Close
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-lg bg-ecomplete-primary text-white font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                            Open Link <ExternalLink size={14}/>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
