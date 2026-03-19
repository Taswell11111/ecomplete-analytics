import React, { useState } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
import { StatusBadge } from './StatusBadge';
import { formatDateZA } from '../utils/dateUtils';
import { ChevronDown, ChevronRight, Search, AlertTriangle } from 'lucide-react';

const columnHelper = createColumnHelper<any>();

export const InboundsTable: React.FC<{ data: any[] }> = ({ data }) => {
  const [globalFilter, setGlobalFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [showVarianceOnly, setShowVarianceOnly] = useState(false);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const columns = [
    columnHelper.display({
      id: 'expander',
      header: () => null,
      cell: ({ row }) => (
        <button onClick={() => toggleRow(row.id)} className="p-1 hover:bg-slate-100 rounded">
          {expandedRows[row.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    }),
    columnHelper.accessor('_store', { header: 'Store' }),
    columnHelper.accessor('type.description', { header: 'Type' }),
    columnHelper.accessor('channelId', { header: 'Channel ID' }),
    columnHelper.accessor('clientId', { header: 'Client Ref' }),
    columnHelper.accessor('supplierReference', { header: 'Supplier Ref' }),
    columnHelper.accessor('id', { header: 'PNJ ID' }),
    columnHelper.accessor('createDate', {
      header: 'Created Date',
      cell: info => formatDateZA(info.getValue()),
    }),
    columnHelper.accessor('status.description', {
      header: 'Status',
      cell: info => <StatusBadge status={info.getValue() || 'Unknown'} />,
    }),
    columnHelper.accessor('deliveryInfo.customer', { 
      header: 'Sender',
      cell: info => info.getValue() || info.row.original.pickupInfo?.recipient || 'Unknown'
    }),
    columnHelper.accessor(row => row.items?.length || 0, { 
      id: 'items',
      header: 'Items' 
    }),
    columnHelper.display({
      id: 'variance',
      header: 'Variance',
      cell: ({ row }) => {
        const hasVariance = row.original.items?.some((item: any) => item.qty !== item.receivedQty && item.receivedQty !== 0);
        return hasVariance ? <AlertTriangle size={16} className="text-amber-500" /> : null;
      }
    }),
  ];

  const filteredData = React.useMemo(() => {
    let result = data;
    if (showVarianceOnly) {
      result = result.filter(row => row.items?.some((item: any) => item.qty !== item.receivedQty && item.receivedQty !== 0));
    }
    if (!globalFilter) return result;
    
    const lowerFilter = globalFilter.toLowerCase();
    return result.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(lowerFilter)
      ) || row.status?.description?.toLowerCase().includes(lowerFilter);
    });
  }, [data, globalFilter, showVarianceOnly]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">Inbounds</h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showVarianceOnly} 
              onChange={e => setShowVarianceOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Show Variance Only
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search inbounds..."
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' 🔼',
                      desc: ' 🔽',
                    }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <React.Fragment key={row.id}>
                <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {expandedRows[row.id] && (
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <td colSpan={columns.length} className="p-6">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-3 uppercase text-xs tracking-wider">Line Items</h4>
                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-100 text-slate-500">
                                <tr>
                                  <th className="px-3 py-2 text-left">SKU</th>
                                  <th className="px-3 py-2 text-left">Name</th>
                                  <th className="px-3 py-2 text-right">Expected</th>
                                  <th className="px-3 py-2 text-right">Received</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.original.items?.map((item: any, idx: number) => {
                                  const hasVariance = item.qty !== item.receivedQty && item.receivedQty !== 0;
                                  return (
                                    <tr key={idx} className={`border-t border-slate-100 ${hasVariance ? 'bg-amber-50' : ''}`}>
                                      <td className="px-3 py-2 font-mono text-slate-600">{item.itemNo}</td>
                                      <td className="px-3 py-2">{item.name}</td>
                                      <td className="px-3 py-2 text-right font-medium">{item.qty}</td>
                                      <td className={`px-3 py-2 text-right font-bold ${hasVariance ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {item.receivedQty}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-3 uppercase text-xs tracking-wider">Event Timeline</h4>
                          <div className="space-y-3">
                            {row.original.events?.map((event: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className="mt-1 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-slate-800">{event.description}</p>
                                  <p className="text-[10px] text-slate-500">{formatDateZA(event.date || event.createDate)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Showing {table.getRowModel().rows.length} of {filteredData.length} entries
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border border-slate-200 rounded text-sm disabled:opacity-50 hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
