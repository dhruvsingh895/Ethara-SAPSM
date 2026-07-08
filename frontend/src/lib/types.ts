export type UserRole = "admin" | "hr" | "pm" | "employee";
export type EmployeeStatus = "active" | "on_leave" | "exited";
export type SeatStatusValue = "available" | "occupied" | "reserved" | "blocked";
export type ProjectStatus = "active" | "on_hold" | "completed";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  employee_id: number | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Employee {
  id: number;
  emp_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  designation: string;
  department: string;
  joining_date: string;
  exit_date?: string | null;
  status: EmployeeStatus;
  manager_id?: number | null;
  current_seat_id?: number | null;
  current_project_id?: number | null;
}

export interface Seat {
  id: number;
  seat_code: string;
  building: string;
  floor: number;
  zone: string;
  seat_number: number;
  status: SeatStatusValue;
  notes?: string | null;
}

export interface Project {
  id: number;
  code: string;
  name: string;
  client: string;
  description?: string | null;
  status: ProjectStatus;
  start_date: string;
  end_date?: string | null;
  required_seats: number;
  pm_id?: number | null;
}

export interface ProjectAssignment {
  id: number;
  employee_id: number;
  project_id: number;
  role: string;
  allocation_pct: number;
  start_date: string;
  end_date?: string | null;
}

export interface Allocation {
  id: number;
  seat_id: number;
  employee_id: number;
  allocated_at: string;
  released_at: string | null;
  allocated_by_id: number | null;
  released_by_id: number | null;
  note: string | null;
}

export interface OccupancySummary {
  total_seats: number;
  available: number;
  occupied: number;
  reserved: number;
  blocked: number;
  occupancy_pct: number;
}

export interface FloorOccupancy {
  building: string;
  floor: number;
  total: number;
  occupied: number;
  available: number;
  occupancy_pct: number;
}

export interface ProjectUtilization {
  project_id: number;
  project_code: string;
  project_name: string;
  active_members: number;
  required_seats: number;
  utilization_pct: number;
}

export interface HeadcountByDept {
  department: string;
  active: number;
}

export interface Overview {
  occupancy: OccupancySummary;
  active_employees: number;
  joiners_last_30_days: number;
  active_projects: number;
  top_departments: HeadcountByDept[];
}
