import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, Clock, User, Clipboard, Play, CheckCircle, Percent } from 'lucide-react';
import { DowntimeReport, ReasonCategory, Worker } from './types';
import { PRODUCTION_LINES, REASON_CATEGORIES, REPORTERS, Product } from './data';
import { calculateDowntimeDuration } from './timeHelpers';

interface DowntimeFormProps {
  reportToEdit?: DowntimeReport | null;
  onSubmit: (report: Omit<DowntimeReport, 'id' | 'createdAt'> & { id?: string }) => void;
  onCancel: () => void;
  products: Product[];
  workers?: Worker[];
}

export default function DowntimeForm({ reportToEdit, onSubmit, onCancel, products, workers = [] }: DowntimeFormProps) {
  // Trạng thái Form
  const [line, setLine] = useState('');
  const [equipment, setEquipment] = useState('');
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | ''>('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca HC'>('Ca 1');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState<number>(0);
  const [details, setDetails] = useState('');
  const [solution, setSolution] = useState('');
  const [pic, setPic] = useState('');
  const [status, setStatus] = useState<'Đang xử lý' | 'Đã khắc phục'>('Đang xử lý');
  
  // Trạng thái sản phẩm & doanh thu
  const [productName, setProductName] = useState('');
  const [productUnitPrice, setProductUnitPrice] = useState<number>(0);
  const [standardRate, setStandardRate] = useState<number>(0);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Nạp dữ liệu cũ khi ở chế độ chỉnh sửa (Edit Mode)
  useEffect(() => {
    if (reportToEdit) {
      setLine(reportToEdit.line);
      setEquipment(reportToEdit.equipment);
      setReasonCategory(reportToEdit.reasonCategory);
      setDate(reportToEdit.date);
      setShift(reportToEdit.shift);
      setStartTime(reportToEdit.startTime);
      setEndTime(reportToEdit.endTime);
      setDuration(reportToEdit.duration);
      setDetails(reportToEdit.details);
      setSolution(reportToEdit.solution || '');
      setPic(reportToEdit.pic);
      setStatus(reportToEdit.status);
      setProductName(reportToEdit.productName || '');
      setProductUnitPrice(reportToEdit.productUnitPrice || 0);
      setStandardRate(reportToEdit.standardRate || 0);
    } else {
      // Giá trị mặc định cho form tạo mới
      setLine('');
      setEquipment('');
      setReasonCategory('');
      setDate(new Date().toISOString().slice(0, 10));
      setShift('Ca 1');
      setStartTime('');
      setEndTime('');
      setDuration(0);
      setDetails('');
      setSolution('');
      setPic('');
      setStatus('Đang xử lý');
      setProductName('');
      setProductUnitPrice(0);
      setStandardRate(0);
    }
    setErrors({});
  }, [reportToEdit]);

  // Tự động tính toán số phút và chuyển đổi trạng thái khi giờ bắt đầu / kết thúc thay đổi
  useEffect(() => {
    if (startTime && endTime) {
      const calculatedMin = calculateDowntimeDuration(startTime, endTime);
      setDuration(calculatedMin);
      
      // Nếu có nhập giờ kết thúc thì mặc định chuyển sang "Đã khắc phục"
      if (!reportToEdit) {
        setStatus('Đã khắc phục');
      }
    } else {
      setDuration(0);
      if (!reportToEdit) {
        setStatus('Đang xử lý');
      }
    }
  }, [startTime, endTime, reportToEdit]);

  // Khi thay đổi giờ kết thúc trực tiếp từ rỗng sang có giá trị
  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (val && status === 'Đang xử lý') {
      setStatus('Đã khắc phục');
    } else if (!val) {
      setStatus('Đang xử lý');
    }
  };

  const handleLineChange = (newLine: string) => {
    setLine(newLine);
    setProductName('');
    setProductUnitPrice(0);
    setStandardRate(0);
  };

  const handleProductSelect = (selectedName: string) => {
    setProductName(selectedName);
    const prod = products.find((p) => p.name === selectedName);
    if (prod) {
      setProductUnitPrice(prod.unitPrice);
      setStandardRate(prod.standardRate);
    } else {
      setProductUnitPrice(0);
      setStandardRate(0);
    }
  };

  // Xác thực dữ liệu Form (Validation)
  const validateForm = () => {
    const tempErrors: Record<string, string> = {};
    if (!line) tempErrors.line = 'Vui lòng chọn Line sản xuất';
    if (!equipment.trim()) tempErrors.equipment = 'Vui lòng nhập tên thiết bị / công đoạn';
    if (!reasonCategory) tempErrors.reasonCategory = 'Vui lòng chọn nhóm nguyên nhân';
    if (!date) tempErrors.date = 'Vui lòng chọn ngày báo cáo';
    if (!startTime) tempErrors.startTime = 'Vui lòng nhập thời gian bắt đầu dừng Line';
    if (!pic.trim()) tempErrors.pic = 'Vui lòng nhập tên người báo cáo/PIC';
    if (!details.trim()) tempErrors.details = 'Vui lòng mô tả chi tiết sự cố';
    if (!productName.trim()) tempErrors.productName = 'Vui lòng chọn hoặc nhập tên sản phẩm';
    if (productUnitPrice <= 0) tempErrors.productUnitPrice = 'Đơn giá sản phẩm phải lớn hơn 0';
    if (standardRate <= 0) tempErrors.standardRate = 'Năng suất tiêu chuẩn phải lớn hơn 0';
    
    if (status === 'Đã khắc phục' && !endTime) {
      tempErrors.endTime = 'Trạng thái "Đã khắc phục" yêu cầu phải nhập Giờ kết thúc';
    }
    
    if (startTime && endTime) {
      const durationMin = calculateDowntimeDuration(startTime, endTime);
      if (durationMin <= 0 && startTime === endTime) {
        tempErrors.endTime = 'Giờ kết thúc không được trùng với giờ bắt đầu';
      }
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    onSubmit({
      id: reportToEdit?.id,
      line,
      equipment: equipment.trim(),
      reasonCategory: reasonCategory as ReasonCategory,
      date,
      shift,
      startTime,
      endTime,
      duration: status === 'Đang xử lý' ? 0 : duration,
      details: details.trim(),
      solution: solution.trim(),
      pic: pic.trim(),
      status,
      productName: productName.trim(),
      productUnitPrice,
      standardRate,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      {/* Header Form */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          {reportToEdit ? 'Chỉnh Sửa Báo Cáo Dừng Line' : 'Tạo Mới Báo Cáo Dừng Line'}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Form */}
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Line sản xuất */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Chuyền / Line sản xuất <span className="text-red-500">*</span>
            </label>
            <select
              value={line}
              onChange={(e) => handleLineChange(e.target.value)}
              className={`w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                errors.line ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">-- Chọn Line sản xuất --</option>
              {PRODUCTION_LINES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {errors.line && <p className="text-xs text-red-500 mt-1">{errors.line}</p>}
          </div>

          {/* Thiết bị / Công đoạn bị lỗi */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Tên Máy / Thiết Bị / Công đoạn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="e.g., Lò nhiệt điện #1, Máy dập, AGV"
              className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                errors.equipment ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.equipment && <p className="text-xs text-red-500 mt-1">{errors.equipment}</p>}
          </div>

          {/* Nhóm nguyên nhân */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Nhóm Nguyên Nhân Dừng Line <span className="text-red-500">*</span>
            </label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value as ReasonCategory)}
              className={`w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                errors.reasonCategory ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">-- Chọn nguyên nhân --</option>
              {REASON_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.reasonCategory && <p className="text-xs text-red-500 mt-1">{errors.reasonCategory}</p>}
          </div>

          {/* Người báo cáo */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Người báo cáo / PIC chịu trách nhiệm <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none z-10">
                <User className="w-4 h-4" />
              </span>
              <select
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                className={`w-full pl-9 pr-3 p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all appearance-none cursor-pointer ${
                  errors.pic ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="">-- Chọn Người báo cáo / Chịu trách nhiệm --</option>
                {workers.length > 0 ? (
                  workers.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name} {w.role ? `(${w.role})` : ''}
                    </option>
                  ))
                ) : (
                  REPORTERS.map((reporter) => (
                    <option key={reporter} value={reporter}>
                      {reporter}
                    </option>
                  ))
                )}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
            {errors.pic && <p className="text-xs text-red-500 mt-1">{errors.pic}</p>}
          </div>

          {/* Thông tin Sản phẩm & Doanh thu */}
          <div className="md:col-span-2 border-t border-dashed border-gray-200 pt-3 mt-1">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Thông tin sản phẩm & Tổn thất doanh thu dự kiến
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Chọn sản phẩm */}
              <div>
                <label className="block text-xs font-bold text-gray-750 text-gray-700 uppercase mb-1">
                  Sản phẩm đang sản xuất <span className="text-red-500">*</span>
                </label>
                <select
                  value={productName}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className={`w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                    errors.productName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    -- Chọn sản phẩm --
                  </option>
                  {products.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {errors.productName && <p className="text-xs text-red-500 mt-1">{errors.productName}</p>}
              </div>

              {/* Đơn giá sản phẩm */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Đơn giá sản phẩm (VNĐ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={productUnitPrice || ''}
                  onChange={(e) => setProductUnitPrice(Number(e.target.value))}
                  disabled={!productName}
                  placeholder="e.g., 4500000"
                  className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                    !productName ? 'bg-gray-50 cursor-not-allowed text-gray-400' : ''
                  } ${errors.productUnitPrice ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                />
                {errors.productUnitPrice && <p className="text-xs text-red-500 mt-1">{errors.productUnitPrice}</p>}
              </div>

              {/* Năng suất tiêu chuẩn */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Năng suất định mức (SP/H) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={standardRate || ''}
                  onChange={(e) => setStandardRate(Number(e.target.value))}
                  disabled={!productName}
                  placeholder="e.g., 60"
                  className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                    !productName ? 'bg-gray-50 cursor-not-allowed text-gray-400' : ''
                  } ${errors.standardRate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                />
                {errors.standardRate && <p className="text-xs text-red-500 mt-1">{errors.standardRate}</p>}
              </div>
            </div>

            {/* Hiển thị thiệt hại ước tính */}
            {productName && productUnitPrice > 0 && standardRate > 0 && duration > 0 && (
              <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-3 flex justify-between items-center text-xs">
                <div className="text-gray-700">
                  <span className="font-medium text-red-850">Sản lượng thất thoát:</span>{' '}
                  <span className="font-bold text-red-900">
                    {Math.round((duration / 60) * standardRate)} sản phẩm
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-red-850">Tổn thất doanh thu ước tính:</span>{' '}
                  <span className="font-extrabold text-red-950">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                      Math.round((duration / 60) * standardRate * productUnitPrice)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ngày báo cáo & Ca */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Ngày báo cáo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full pl-9 pr-2 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                    errors.date ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Ca sản xuất
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as 'Ca 1' | 'Ca 2' | 'Ca 3' | 'Ca HC')}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
              >
                <option value="Ca 1">Ca 1 (06h00 - 14h00)</option>
                <option value="Ca 2">Ca 2 (14h00 - 22h00)</option>
                <option value="Ca 3">Ca 3 (22h00 - 06h00)</option>
                <option value="Ca HC">Ca HC (08h00 - 17h00)</option>
              </select>
            </div>
          </div>

          {/* Giờ bắt đầu, Giờ kết thúc, Thời lượng */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Bắt đầu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400 pointer-events-none">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`w-full pl-7 pr-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                    errors.startTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.startTime && <p className="text-xs text-red-500 mt-1">{errors.startTime}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Kết thúc
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-400 pointer-events-none">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  placeholder="--"
                  className={`w-full pl-7 pr-1 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
                    errors.endTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.endTime && <p className="text-xs text-red-500 mt-1">{errors.endTime}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Số phút dừng
              </label>
              <div className="w-full p-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-center font-bold text-gray-700 h-[38px] flex items-center justify-center">
                {status === 'Đang xử lý' ? 'Đang chạy...' : `${duration} phút`}
              </div>
            </div>
          </div>

        </div>

        {/* Trạng thái sự cố */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Trạng Thái Khắc Phục
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus('Đang xử lý');
                setEndTime(''); // Xóa giờ kết thúc nếu chuyển về Đang xử lý
              }}
              className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                status === 'Đang xử lý'
                  ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Play className="w-4 h-4 shrink-0" />
              ĐANG XỬ LÝ (Line dừng chạy)
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus('Đã khắc phục');
                if (!endTime) {
                  // Điền giờ hiện tại nếu rỗng
                  const now = new Date();
                  const hh = String(now.getHours()).padStart(2, '0');
                  const mm = String(now.getMinutes()).padStart(2, '0');
                  setEndTime(`${hh}:${mm}`);
                }
              }}
              className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                status === 'Đã khắc phục'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              ĐÃ KHẮC PHỤC (Sản xuất lại)
            </button>
          </div>
        </div>

        {/* Chi tiết sự cố */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Chi tiết Sự Cố / Biểu hiện / Nguyên nhân sơ bộ <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Mô tả cụ thể sự cố (Ví dụ: Máy báo lỗi quá dòng hỏng bạc đạn trục chính, mẻ dao gọt bavia...)"
            className={`w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all ${
              errors.details ? 'border-red-500 bg-red-50' : 'border-gray-300'
            }`}
          />
          {errors.details && <p className="text-xs text-red-500 mt-1">{errors.details}</p>}
        </div>

        {/* Biện pháp khắc phục */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Biện pháp Khắc Phục / Hành động sửa chữa
          </label>
          <textarea
            rows={2}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            placeholder="Ghi lại các thao tác kỹ thuật đã thực hiện để đưa Line hoạt động trở lại."
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Clipboard className="w-4 h-4" />
            {reportToEdit ? 'Cập Nhật Báo Cáo' : 'Lưu Báo Cáo'}
          </button>
        </div>
      </form>
    </div>
  );
}
