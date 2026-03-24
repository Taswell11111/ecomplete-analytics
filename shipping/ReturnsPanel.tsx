import React, { useMemo } from 'react';
import { useShipments } from '../hooks/useShipments';
import { useInbounds } from '../hooks/useInbounds';
import { StatusBadge } from './StatusBadge';
import { formatDateZA } from '../utils/dateUtils';
import { differenceInDays, parseISO } from 'date-fns';

export const ReturnsPanel: React.FC<{ appContext: 'levis' | 'bounty' | 'admin' }> = ({ appContext }) => {
  const { data: outboundsData } = useShipments(90, appContext); // Fetch longer period for matching
  const { data: inboundsData } = useInbounds(30, appContext);

  const outbounds = outboundsData?.data || [];
  const inbounds = inboundsData?.data || [];

  const { linkedPairs, unlinkedCount } = useMemo(() => {
    const returns = inbounds.filter(i => i.type?.description?.toLowerCase().includes('return'));
    const linked: any[] = [];
    let unlinked = 0;

    returns.forEach(ret => {
      const match = outbounds.find(out => 
        (ret.clientId && out.clientId && ret.clientId === out.clientId) ||
        (ret.supplierReference && out.channelId && ret.supplierReference === out.channelId) ||
        (ret.channelId && out.channelId && ret.channelId === out.channelId)
      );

      if (match) {
        let daysToReturn = null;
        if (ret.createDate && match.createDate) {
          try {
            daysToReturn = differenceInDays(parseISO(ret.createDate), parseISO(match.createDate));
          } catch (e) {}
        }
        
        linked.push({
          inbound: ret,
          outbound: match,
          daysToReturn
        });
      } else {
        unlinked++;
      }
    });

    return { linkedPairs: linked, unlinkedCount: unlinked };
  }, [outbounds, inbounds]);

  return (
    <div className="space-y-6 pt-8 border-t border-slate-200">
      <div className="flex justify-between items-end border-b border-slate-200 pb-2">
        <h3 className="text-xl font-bold text-slate-800">Returns Reconciliation</h3>
        <div className="text-sm font-medium text-slate-500">
          Unlinked Returns: <span className="text-amber-600 font-bold">{unlinkedCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Original Order</th>
                <th className="px-4 py-3 font-medium">Store</th>
                <th className="px-4 py-3 font-medium">Outbound Status</th>
                <th className="px-4 py-3 font-medium">Return Status</th>
                <th className="px-4 py-3 font-medium">Return Reason</th>
                <th className="px-4 py-3 font-medium">SKU(s)</th>
                <th className="px-4 py-3 font-medium">Days to Return</th>
              </tr>
            </thead>
            <tbody>
              {linkedPairs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No linked returns found in the selected period.
                  </td>
                </tr>
              ) : (
                linkedPairs.map((pair, idx) => {
                  const out = pair.outbound;
                  const ret = pair.inbound;
                  
                  // Extract return reason from outbound items if present
                  const returnReasons = out.items?.filter((i: any) => i.returnReason).map((i: any) => i.returnReason) || [];
                  const uniqueReasons = [...new Set(returnReasons)].join(', ') || 'Not specified';
                  
                  const skus = ret.items?.map((i: any) => i.itemNo).join(', ') || '-';

                  return (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{out.channelId || out.clientId}</td>
                      <td className="px-4 py-3">{out._store}</td>
                      <td className="px-4 py-3"><StatusBadge status={out.status?.description || 'Unknown'} /></td>
                      <td className="px-4 py-3"><StatusBadge status={ret.status?.description || 'Unknown'} /></td>
                      <td className="px-4 py-3 text-orange-600">{uniqueReasons}</td>
                      <td className="px-4 py-3 font-mono text-xs">{skus}</td>
                      <td className="px-4 py-3 font-medium">{pair.daysToReturn !== null ? `${pair.daysToReturn} days` : '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
