import { COPY } from '../lib/copy'
import { useAuth } from './useAuth'

/** Role-specific wording for the logged-in user (tenant wording until a role is chosen). */
export const useCopy = () => COPY[useAuth().user?.role] ?? COPY.tenant
