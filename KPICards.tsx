import { motion } from 'motion/react';
import { Clock, AlertTriangle, Hammer, TrendingUp, Coins, TrendingDown } from 'lucide-react';
import { DowntimeReport } from './types';
import { formatDurationToReadable, calculateDowntimeCost, formatVND } from './timeHelpers';

interface KPICardsProps {
  reports: DowntimeReport[];
}

export default function KPICards({ reports }: KPICardsProps) {
  // 1. Tính toán số liệu
  const totalIncidents = reports.length;
  const activeIncidents = reports.filter(r => r.status === 'Đang xử lý').length;
  const completedIncidents = reports.filter(r => r.status === 'Đã khắc phục');
  
  const totalDowntime = reports.reduce((sum, r) => sum + r.duration, 0);
  const totalCost = calculateDowntimeCost(totalDowntime);
  
  // Tính tổng thất thoát doanh thu và sản lượng bị mất
  const totalRevenueLoss = reports.reduce((sum, r) => {
    if (r.status === 'Đang xử lý') return sum;
    const loss = (r.duration / 60) * (r.standardRate || 0) * (r.productUnitPrice || 0);
    return sum + loss;
  }, 0);

  const totalProductsLost = reports.reduce((sum, r) => {
    if (r.status === 'Đang xử lý') return sum;
    return sum + ((r.duration / 60) * (r.standardRate || 0));
  }, 0);

  // MTTR (Thời gian khắc phục trung bình) tính trên các sự cố đã hoàn thành
  const avgDuration = completedIncidents.length > 0 
    ? Math.round(completedIncidents.reduce((sum, r) => sum + r.duration, 0) / completedIncidents.length) 
    : 0;

  // Tìm Line bị dừng nhiều nhất
  const lineDowntimeMap: Record<string, number> = {};
  reports.forEach(r => {
    lineDowntimeMap[r.line] = (lineDowntimeMap[r.line] || 0) + r.duration;
  });
  
  let worstLine = { name: 'N/A', duration: 0 };
  Object.entries(lineDowntimeMap).forEach(([name, duration]) => {
    if (duration > worstLine.duration) {
      worstLine = { name, duration };
    }
  });

  const cards = [
    {
      id: 'kpi-downtime',
      title: 'Tổng Thời Gian Dừng Line',
      value: formatDurationToReadable(totalDowntime),
      subtext: `Tổng số ${totalDowntime.toLocaleString()} phút dừng máy`,
      icon: Clock,
      color: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-red-100 dark:border-red-900/30',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
    },
    {
      id: 'kpi-cost',
      title: 'Chi Phí Dừng Sản Xuất',
      value: formatVND(totalCost),
      subtext: 'Định mức 80tr / 8h (10tr/h)',
      icon: Coins,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      iconBg: 'bg-rose-100 text-rose-600',
    },
    {
      id: 'kpi-revenue-loss',
      title: 'Ảnh Hưởng Doanh Thu',
      value: formatVND(totalRevenueLoss),
      subtext: `Thất thoát ~${Math.round(totalProductsLost).toLocaleString()} sản phẩm`,
      icon: TrendingDown,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    {
      id: 'kpi-incidents',
      title: 'Tần Suất Sự Cố',
      value: `${totalIncidents} Vụ việc`,
      subtext: activeIncidents > 0 
        ? `${activeIncidents} vụ đang xử lý ⚠️` 
        : '100% sự cố đã được đóng',
      icon: AlertTriangle,
      color: activeIncidents > 0
        ? 'bg-orange-50 text-orange-600 border-orange-100'
        : 'bg-emerald-50 text-emerald-600 border-emerald-100',
      iconBg: activeIncidents > 0 ? 'bg-orange-100' : 'bg-emerald-100',
    },
    {
      id: 'kpi-mttr',
      title: 'Thời Gian Sửa Chữa TB (MTTR)',
      value: `${avgDuration} phút/vụ`,
      subtext: `Tính trên ${completedIncidents.length} sự cố đã đóng`,
      icon: Hammer,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      iconBg: 'bg-blue-100',
    },
    {
      id: 'kpi-worst-line',
      title: 'Line Dừng Nhiều Nhất',
      value: worstLine.name,
      subtext: worstLine.duration > 0 
        ? `${formatDurationToReadable(worstLine.duration)} (${formatVND(calculateDowntimeCost(worstLine.duration))})` 
        : 'Chưa có dữ liệu dừng Line',
      icon: TrendingUp,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      iconBg: 'bg-purple-100',
    }
  ];

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 25 } },
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
    >
      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <motion.div
            key={card.id}
            id={card.id}
            variants={cardVariants}
            className={`p-5 rounded-xl border flex items-start space-x-4 shadow-sm bg-white hover:shadow-md transition-shadow duration-200`}
          >
            <div className={`p-3 rounded-lg ${card.iconBg}`}>
              <IconComponent className="w-6 h-6 text-current" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider truncate">
                {card.title}
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1 truncate">
                {card.value}
              </h3>
              <p className="text-xs text-gray-600 mt-1 font-medium truncate">
                {card.subtext}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
