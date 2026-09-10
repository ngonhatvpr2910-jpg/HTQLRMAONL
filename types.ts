export interface LotInfo {
  lotNumber: string;
  productName: string;
  productCode: string;
  createdAt: string;
}

export enum WorkflowStep {
  RMA_IN = 'RMA_IN',
  EVALUATION = 'EVALUATION',
  QUOTED = 'QUOTED',
  REWORK = 'REWORK',
  FINISHED = 'FINISHED',
  LIQUIDATION = 'LIQUIDATION',
}

export const WORKFLOW_STEPS = [
  { id: WorkflowStep.RMA_IN, label: '1. Nhập RMA', fullLabel: '1. Nhập hàng lỗi (RMA)' },
  { id: WorkflowStep.EVALUATION, label: '2. Đánh giá', fullLabel: '2. Đánh giá vật tư hư hỏng' },
  { id: WorkflowStep.QUOTED, label: '3. Đã báo giá', fullLabel: '3. Đã báo giá' },
  { id: WorkflowStep.REWORK, label: '4. Sản xuất', fullLabel: '4. Kéo hàng & Sản xuất Rework' },
  { id: WorkflowStep.FINISHED, label: '5. Nhập kho', fullLabel: '5. Nhập kho & Xuất trả' },
  { id: WorkflowStep.LIQUIDATION, label: '6. Thanh lý', fullLabel: '6. Chuyển trả thanh lý' },
];

export interface Ticket {
  id: string;
  productName: string;
  productCode?: string;
  lotNumber: string;
  serialNumber: string;
  quantity: number;
  issueDescription: string;
  status: WorkflowStep;
  createdAt: string;
  updatedAt: string;
  imei?: string;

  // Step 2: Evaluation
  evaluationNotes?: string;
  damagedParts?: string[];

  // Step 3: Quoted
  quotationAmount?: number;

  // Step 4: Rework
  reworkNotes?: string;
  
  // Step 5: Finished
  returnLocation?: string;
}

export interface Worker {
  id: string;
  name: string;
  code?: string;
  role?: string;
  department?: string;
  phone?: string;
  email?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

