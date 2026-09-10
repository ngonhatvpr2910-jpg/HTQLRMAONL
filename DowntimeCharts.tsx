import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LabelList,
} from 'recharts';
import { DowntimeReport } from './types';
import { REASON_COLORS, REASON_CATEGORIES, PRODUCTION_LINES } from './data';

interface DowntimeChartsProps {
  reports: DowntimeReport[];
}

export default function DowntimeCharts({ reports }: DowntimeChartsProps) {
  // Bộ chọn chế độ phân tích: theo "Thời gian (Phút)", "Số vụ việc (Tần suất)", "Chi phí dừng (VNĐ)", hoặc "Tổn thất Doanh thu (VNĐ)"
  const [analysisMetric, setAnalysisMetric] = useState<'duration' | 'count' | 'cost' | 'revenue'>('duration');

  // Bộ chọn chu kỳ xu hướng: ngày, tuần, tháng, năm
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // 1. Phân tích Dừng Line theo Từng Chuyền (Production Lines)
  const lineChartData = useMemo(() => {
    const dataMap: Record<string, { duration: number; count: number; revenueLoss: number }> = {};
    PRODUCTION_LINES.forEach(line => {
      dataMap[line] = { duration: 0, count: 0, revenueLoss: 0 };
    });

    reports.forEach(r => {
      const loss = r.status === 'Đang xử lý' ? 0 : (r.duration / 60) * (r.standardRate || 0) * (r.productUnitPrice || 0);
      if (dataMap[r.line]) {
        dataMap[r.line].duration += r.duration;
        dataMap[r.line].count += 1;
        dataMap[r.line].revenueLoss += loss;
      } else {
        dataMap[r.line] = { duration: r.duration, count: 1, revenueLoss: loss };
      }
    });

    return Object.entries(dataMap).map(([name, val]) => {
      const cost = Math.round(val.duration * (80000000 / 480));
      const costMillion = Number((val.duration * (80 / 480)).toFixed(2));
      const revenueLossMillion = Number((val.revenueLoss / 1000000).toFixed(2));
      return {
        name: name.replace('Dây chuyền ', '').replace('Dây Chuyền ', ''), // Rút gọn tên hiển thị e.g. "LR RO" hoặc "Bếp Gas"
        fullName: name,
        duration: val.duration,
        count: val.count,
        cost,
        costMillion,
        revenueLoss: val.revenueLoss,
        revenueLossMillion,
      };
    }).sort((a, b) => {
      if (analysisMetric === 'cost') {
        return b.cost - a.cost;
      }
      if (analysisMetric === 'revenue') {
        return b.revenueLoss - a.revenueLoss;
      }
      return b[analysisMetric] - a[analysisMetric];
    });
  }, [reports, analysisMetric]);

  // 2. Phân tích Theo Nhóm Nguyên Nhân (Reason Categories)
  const reasonChartData = useMemo(() => {
    const dataMap: Record<string, { duration: number; count: number; revenueLoss: number }> = {};
    REASON_CATEGORIES.forEach(cat => {
      dataMap[cat] = { duration: 0, count: 0, revenueLoss: 0 };
    });

    reports.forEach(r => {
      const loss = r.status === 'Đang xử lý' ? 0 : (r.duration / 60) * (r.standardRate || 0) * (r.productUnitPrice || 0);
      if (dataMap[r.reasonCategory]) {
        dataMap[r.reasonCategory].duration += r.duration;
        dataMap[r.reasonCategory].count += 1;
        dataMap[r.reasonCategory].revenueLoss += loss;
      }
    });

    return Object.entries(dataMap)
      .map(([name, val]) => {
        let value = 0;
        if (analysisMetric === 'duration') {
          value = val.duration;
        } else if (analysisMetric === 'count') {
          value = val.count;
        } else if (analysisMetric === 'cost') {
          value = Number((val.duration * (80 / 480)).toFixed(2)); // cost in million VND
        } else {
          value = Number((val.revenueLoss / 1000000).toFixed(2)); // revenue loss in million VND
        }
        return {
          name,
          value,
          color: REASON_COLORS[name as keyof typeof REASON_COLORS] || '#6B7280',
        };
      })
      .filter(item => item.value > 0); // Chỉ hiển thị các nhóm nguyên nhân có phát sinh sự cố
  }, [reports, analysisMetric]);

  // 3. Phân tích Xu Hướng Theo Chu Kỳ (Ngày / Tuần / Tháng)
  const trendChartData = useMemo(() => {
    if (trendMode === 'day') {
      const dataMap: Record<string, { duration: number; count: number }> = {};
      const dates = Array.from(new Set(reports.map(r => r.date))).sort();
      const lastNDates = dates.slice(-10); // Hiển thị tối đa 10 ngày gần đây
      lastNDates.forEach(date => {
        dataMap[date] = { duration: 0, count: 0 };
      });

      reports.forEach(r => {
        if (dataMap[r.date] !== undefined) {
          dataMap[r.date].duration += r.duration;
          dataMap[r.date].count += 1;
        }
      });

      return Object.entries(dataMap).map(([date, val]) => {
        const parts = date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : date;
        return {
          name: formattedDate,
          duration: val.duration,
          count: val.count,
        };
      });
    } else if (trendMode === 'week') {
      const dataMap: Record<string, { duration: number; count: number }> = {};
      reports.forEach(r => {
        const d = new Date(r.date);
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
        const label = `Tuần ${weekNum}`;
        
        if (!dataMap[label]) {
          dataMap[label] = { duration: 0, count: 0 };
        }
        dataMap[label].duration += r.duration;
        dataMap[label].count += 1;
      });

      return Object.entries(dataMap)
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([name, val]) => ({
          name,
          duration: val.duration,
          count: val.count,
        }));
    } else if (trendMode === 'month') {
      const dataMap: Record<string, { duration: number; count: number }> = {};
      reports.forEach(r => {
        const parts = r.date.split('-');
        const label = parts.length >= 2 ? `Tháng ${parts[1]}/${parts[0].slice(2)}` : r.date;
        
        if (!dataMap[label]) {
          dataMap[label] = { duration: 0, count: 0 };
        }
        dataMap[label].duration += r.duration;
        dataMap[label].count += 1;
      });

      return Object.entries(dataMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, val]) => ({
          name,
          duration: val.duration,
          count: val.count,
        }));
    } else {
      // year
      const dataMap: Record<string, { duration: number; count: number }> = {};
      reports.forEach(r => {
        const parts = r.date.split('-');
        const label = parts.length >= 1 ? `Năm ${parts[0]}` : r.date;
        
        if (!dataMap[label]) {
          dataMap[label] = { duration: 0, count: 0 };
        }
        dataMap[label].duration += r.duration;
        dataMap[label].count += 1;
      });

      return Object.entries(dataMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, val]) => ({
          name,
          duration: val.duration,
          count: val.count,
        }));
    }
  }, [reports, trendMode]);

  // 4. Phân tích theo Ca Làm Việc (Shifts)
  const shiftChartData = useMemo(() => {
    const dataMap: Record<string, { duration: number; count: number }> = {
      'Ca 1': { duration: 0, count: 0 },
      'Ca 2': { duration: 0, count: 0 },
      'Ca 3': { duration: 0, count: 0 },
      'Ca HC': { duration: 0, count: 0 },
    };

    reports.forEach(r => {
      if (dataMap[r.shift]) {
        dataMap[r.shift].duration += r.duration;
        dataMap[r.shift].count += 1;
      }
    });

    return Object.entries(dataMap).map(([name, val]) => ({
      name,
      duration: val.duration,
      count: val.count,
    }));
  }, [reports]);

  // 5. So sánh Lũy kế Ngày (Hôm nay) vs Tuần (Tuần này) vs Tháng (Tháng này)
  const periodComparisonData = useMemo(() => {
    const todayStr = '2026-06-26';
    const todayDate = new Date(todayStr);
    
    // Ngày đầu tuần (chủ nhật)
    const sunday = new Date(todayDate);
    sunday.setDate(todayDate.getDate() - todayDate.getDay());
    const startOfWeekStr = sunday.toISOString().slice(0, 10);
    
    // Ngày đầu tháng
    const startOfMonthStr = `${todayStr.slice(0, 7)}-01`;

    let todayDuration = 0, todayCount = 0, todayCost = 0, todayLoss = 0;
    let weekDuration = 0, weekCount = 0, weekCost = 0, weekLoss = 0;
    let monthDuration = 0, monthCount = 0, monthCost = 0, monthLoss = 0;

    reports.forEach(r => {
      const loss = r.status === 'Đang xử lý' ? 0 : (r.duration / 60) * (r.standardRate || 0) * (r.productUnitPrice || 0);
      const cost = Math.round(r.duration * (80000000 / 480));

      // Hôm nay
      if (r.date === todayStr) {
        todayDuration += r.duration;
        todayCount += 1;
        todayCost += cost;
        todayLoss += loss;
      }
      // Tuần này
      if (r.date >= startOfWeekStr && r.date <= todayStr) {
        weekDuration += r.duration;
        weekCount += 1;
        weekCost += cost;
        weekLoss += loss;
      }
      // Tháng này
      if (r.date >= startOfMonthStr && r.date <= todayStr) {
        monthDuration += r.duration;
        monthCount += 1;
        monthCost += cost;
        monthLoss += loss;
      }
    });

    const getMetricValue = (duration: number, count: number, cost: number, loss: number) => {
      if (analysisMetric === 'duration') return duration;
      if (analysisMetric === 'count') return count;
      if (analysisMetric === 'cost') return Number((cost / 1000000).toFixed(2));
      return Number((loss / 1000000).toFixed(2));
    };

    return [
      {
        name: 'Hôm nay (Ngày)',
        value: getMetricValue(todayDuration, todayCount, todayCost, todayLoss),
        duration: todayDuration,
        count: todayCount,
        costMillion: Number((todayCost / 1000000).toFixed(2)),
        lossMillion: Number((todayLoss / 1000000).toFixed(2)),
      },
      {
        name: 'Tuần này (Tuần)',
        value: getMetricValue(weekDuration, weekCount, weekCost, weekLoss),
        duration: weekDuration,
        count: weekCount,
        costMillion: Number((weekCost / 1000000).toFixed(2)),
        lossMillion: Number((weekLoss / 1000000).toFixed(2)),
      },
      {
        name: 'Tháng này (Tháng)',
        value: getMetricValue(monthDuration, monthCount, monthCost, monthLoss),
        duration: monthDuration,
        count: monthCount,
        costMillion: Number((monthCost / 1000000).toFixed(2)),
        lossMillion: Number((monthLoss / 1000000).toFixed(2)),
      }
    ];
  }, [reports, analysisMetric]);

  // Bộ định dạng tùy biến cho Tooltip Recharts
  const customTooltipFormatter = (value: any, name: string) => {
    if (analysisMetric === 'duration') {
      return [`${value} phút`, name === 'duration' ? 'Thời gian dừng' : name];
    }
    if (analysisMetric === 'count') {
      return [`${value} vụ`, name === 'count' ? 'Số lần dừng' : name];
    }
    return [`${value} triệu VNĐ`, name === 'cost' ? 'Chi phí dừng' : 'Tổn thất doanh thu'];
  };

  return (
    <div className="space-y-6">
      {/* Thanh lựa chọn Chế độ Phân tích */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded-lg border border-gray-100 gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">
            Trung Tâm Phân Tích Biểu Đồ
          </h4>
          <p className="text-xs text-gray-500">
            Thay đổi chỉ số để phân tích về thời lượng dừng, tần suất sự cố, chi phí vận hành dừng máy hoặc tổn thất doanh thu thực tế.
          </p>
        </div>
        <div className="flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm self-end sm:self-auto gap-1 flex-wrap">
          <button
            onClick={() => setAnalysisMetric('duration')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              analysisMetric === 'duration'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Theo Thời Gian (Phút)
          </button>
          <button
            onClick={() => setAnalysisMetric('count')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              analysisMetric === 'count'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Theo Tần Suất (Số Vụ)
          </button>
          <button
            onClick={() => setAnalysisMetric('cost')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              analysisMetric === 'cost'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Chi Phí Dừng Chuyền
          </button>
          <button
            onClick={() => setAnalysisMetric('revenue')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              analysisMetric === 'revenue'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Thất Thoát Doanh Thu
          </button>
        </div>
      </div>

      {/* Grid Biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ Cột - So sánh giữa các Line sản xuất */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            {analysisMetric === 'duration' && 'Tổng Thời Gian Dừng Theo Line Sản Xuất (phút)'}
            {analysisMetric === 'count' && 'Tổng Tần Suất Sự Cố Theo Line Sản Xuất (vụ)'}
            {analysisMetric === 'cost' && 'Chi Phí Dừng Line Theo Line Sản Xuất (Triệu VNĐ)'}
            {analysisMetric === 'revenue' && 'Tổn Thất Doanh Thu Sản Phẩm Theo Line (Triệu VNĐ)'}
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lineChartData}
                margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => {
                    if (analysisMetric === 'cost' || analysisMetric === 'revenue') return `${val} Tr`;
                    return val;
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{
                    backgroundColor: '#FFF',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '12px',
                  }}
                  formatter={(val) => [
                    analysisMetric === 'cost' || analysisMetric === 'revenue' ? `${val} triệu VNĐ` : (analysisMetric === 'duration' ? `${val} phút` : `${val} vụ`),
                    analysisMetric === 'cost' ? 'Chi phí dừng Line' : (analysisMetric === 'revenue' ? 'Tổn thất doanh thu' : (analysisMetric === 'duration' ? 'Tổng thời lượng' : 'Số vụ việc'))
                  ]}
                />
                <Bar
                  dataKey={analysisMetric === 'cost' ? 'costMillion' : (analysisMetric === 'revenue' ? 'revenueLossMillion' : analysisMetric)}
                  fill={analysisMetric === 'cost' ? '#E11D48' : (analysisMetric === 'revenue' ? '#10B981' : (analysisMetric === 'duration' ? '#EF4444' : '#F59E0B'))}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={35}
                  isAnimationActive={false}
                >
                  <LabelList 
                    dataKey={analysisMetric === 'cost' ? 'costMillion' : (analysisMetric === 'revenue' ? 'revenueLossMillion' : analysisMetric)}
                    position="top"
                    style={{ fontSize: 10, fill: '#374151', fontWeight: 'bold' }}
                    formatter={(val: number) => {
                      if (!val) return '0';
                      if (analysisMetric === 'cost' || analysisMetric === 'revenue') {
                        return `${val} Tr`;
                      }
                      if (analysisMetric === 'duration') {
                        return `${val} p`;
                      }
                      return `${val} vụ`;
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ Tròn - Phân tích lý do dừng line */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[350px]">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
            Tỉ Lệ Phân Bổ Theo Nhóm Nguyên Nhân
          </h3>
          <div className="flex-1 flex items-center justify-center min-h-0">
            {reasonChartData.length === 0 ? (
              <p className="text-xs text-gray-400">Không có dữ liệu phù hợp để biểu diễn</p>
            ) : (
              <div className="w-full h-full flex flex-col sm:flex-row items-center">
                <div className="w-full sm:w-1/2 h-[180px] sm:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reasonChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {reasonChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFF',
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                          fontSize: '11px',
                        }}
                        formatter={(val) => [
                          analysisMetric === 'cost' || analysisMetric === 'revenue' ? `${val} triệu VNĐ` : (analysisMetric === 'duration' ? `${val} phút` : `${val} vụ`),
                          analysisMetric === 'cost' ? 'Chi phí dừng Line' : (analysisMetric === 'revenue' ? 'Tổn thất doanh thu' : 'Giá trị')
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Chú giải tùy biến để có giao diện gọn gàng */}
                <div className="w-full sm:w-1/2 flex flex-col justify-center space-y-1 text-[11px] max-h-[160px] overflow-y-auto pr-2">
                  {reasonChartData.map((entry, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-gray-600 truncate flex-1" title={entry.name}>
                        {entry.name}
                      </span>
                      <span className="font-bold text-gray-900">
                        {entry.value}{analysisMetric === 'duration' ? 'p' : (analysisMetric === 'count' ? 'v' : ' Tr')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ Xu hướng ngày / tuần / tháng / năm */}
        <div className="lg:col-span-12 bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[320px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              So Sánh Dừng Chuyền Theo {trendMode === 'day' ? 'Ngày' : trendMode === 'week' ? 'Tuần' : trendMode === 'month' ? 'Tháng' : 'Năm'}
            </h3>
            <div className="flex bg-gray-150 p-1 rounded-lg gap-1 border border-gray-200 shadow-inner self-end sm:self-auto">
              <button
                onClick={() => setTrendMode('day')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  trendMode === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Các Ngày
              </button>
              <button
                onClick={() => setTrendMode('week')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  trendMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Các Tuần
              </button>
              <button
                onClick={() => setTrendMode('month')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  trendMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Các Tháng
              </button>
              <button
                onClick={() => setTrendMode('year')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  trendMode === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Các Năm
              </button>
            </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendChartData}
                margin={{ top: 25, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => {
                    if (name === 'Thời gian dừng (Phút)') {
                      const costVal = (Number(value) * (80 / 480)).toFixed(2);
                      return [
                        <span>
                          {value} phút <span className="text-emerald-600 font-bold">({costVal} triệu đ)</span>
                        </span>,
                        'Thời gian dừng'
                      ];
                    }
                    return [`${value} vụ`, 'Số vụ việc'];
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="duration"
                  name="Thời gian dừng (Phút)"
                  fill="#EF4444"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={25}
                  isAnimationActive={false}
                >
                  <LabelList 
                    dataKey="duration" 
                    position="top" 
                    style={{ fontSize: 9, fill: '#B91C1C', fontWeight: 'bold' }} 
                    formatter={(val: number) => val > 0 ? `${val}p` : ''}
                  />
                </Bar>
                <Bar
                  yAxisId="right"
                  dataKey="count"
                  name="Số vụ dừng Line (Vụ)"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={25}
                  isAnimationActive={false}
                >
                  <LabelList 
                    dataKey="count" 
                    position="top" 
                    style={{ fontSize: 9, fill: '#1D4ED8', fontWeight: 'bold' }} 
                    formatter={(val: number) => val > 0 ? `${val}v` : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
