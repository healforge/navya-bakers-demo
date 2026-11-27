import { useLanguage } from '@/i18n/useLanguage'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Download, LogOut, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { ROLE_LABEL, session, useCurrentUser } from '@/auth/session'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useInstallPrompt } from '@/components/pwa/useInstallPrompt'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { dbActions } from '@/store/db'

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()

export function UserMenu() {
  const { t } = useLanguage()
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { canInstall, install } = useInstallPrompt()
  const [confirmReset, setConfirmReset] = useState(false)
  if (!user) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('User menu')}>
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="font-medium">{user.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{t(ROLE_LABEL[user.role])} · @{user.username}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canInstall && (
            <DropdownMenuItem onSelect={() => void install()}>
              <Download /> {t('Install app')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
            <RotateCcw /> {t('Reset demo data')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              session.logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut /> {t('Sign out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('Reset demo data?')}
        description={t('This regenerates all demo data (bills, stock, indents, history) anchored at today and discards any changes you made.')}
        confirmLabel={t('Reset')}
        destructive
        onConfirm={() => {
          dbActions.resetDemoData()
          toast.success(t('Demo data reset'))
        }}
      />
    </>
  )
}
