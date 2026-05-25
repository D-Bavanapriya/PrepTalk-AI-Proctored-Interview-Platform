import { create } from 'zustand';

export interface Question {
  id: string;
  text: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  followUp?: string;
}

export interface Answer {
  questionId: string;
  text: string;
  duration: number;
  score?: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  expectedAnswer?: string;
}

export interface ProctoringEvent {
  id: string;
  type: 'tab_switch' | 'face_not_visible' | 'multiple_faces' | 'poor_posture' | 'looking_away' | 'low_light';
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  description: string;
}

export interface InterviewSession {
  id: string;
  jobTitle: string;
  jobDescription: string;
  experienceLevel: string;
  questions: Question[];
  answers: Answer[];
  currentQuestionIndex: number;
  startTime: number | null;
  endTime: number | null;
  proctoringEvents: ProctoringEvent[];
  status: 'setup' | 'briefing' | 'active' | 'completed' | 'terminated';
  overallScore?: number;
  proctoringScore?: number;
  reportSummary?: string;
}

interface Store {
  session: InterviewSession | null;
  isLoading: boolean;
  error: string | null;
  createSession: (jobTitle: string, jobDescription: string, experienceLevel: string) => void;
  setQuestions: (questions: Question[]) => void;
  startInterview: () => void;
  nextQuestion: () => void;
  submitAnswer: (answer: Answer) => void;
  addProctoringEvent: (event: Omit<ProctoringEvent, 'id' | 'timestamp'>) => void;
  completeInterview: (overallScore: number, proctoringScore: number, summary: string) => void;
  terminateInterview: (reason: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSession: () => void;
}

let sid = 0;
let eid = 0;

export const useInterviewStore = create<Store>((set, get) => ({
  session: null,
  isLoading: false,
  error: null,

  createSession: (jobTitle, jobDescription, experienceLevel) => {
    set({
      session: {
        id: `session_${++sid}_${Date.now()}`,
        jobTitle, jobDescription, experienceLevel,
        questions: [], answers: [],
        currentQuestionIndex: 0,
        startTime: null, endTime: null,
        proctoringEvents: [],
        status: 'setup',
      },
      error: null,
    });
  },

  setQuestions: (questions) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, questions, status: 'briefing' } });
  },

  startInterview: () => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, status: 'active', startTime: Date.now() } });
  },

  nextQuestion: () => {
    const { session } = get();
    if (!session) return;
    const next = session.currentQuestionIndex + 1;
    if (next >= session.questions.length) {
      set({ session: { ...session, status: 'completed', endTime: Date.now() } });
    } else {
      set({ session: { ...session, currentQuestionIndex: next } });
    }
  },

  submitAnswer: (answer) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, answers: [...session.answers, answer] } });
  },

  addProctoringEvent: (event) => {
    const { session } = get();
    if (!session) return;
    const full: ProctoringEvent = { ...event, id: `evt_${++eid}`, timestamp: Date.now() };
    set({ session: { ...session, proctoringEvents: [...session.proctoringEvents, full] } });
  },

  completeInterview: (overallScore, proctoringScore, reportSummary) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, status: 'completed', endTime: Date.now(), overallScore, proctoringScore, reportSummary } });
  },

  terminateInterview: (reason) => {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, status: 'terminated', endTime: Date.now(), reportSummary: `Terminated: ${reason}` } });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  resetSession: () => set({ session: null, error: null, isLoading: false }),
}));
