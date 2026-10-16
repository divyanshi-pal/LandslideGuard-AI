import { Link } from 'react-router'
import { MountainIcon } from '../components/Icons'
import { Card, EmptyState } from '../components/ui'

export default function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState
        icon={<MountainIcon className="h-6 w-6" />}
        title="Page not found"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/" className="btn-primary">Go to home</Link>
            <Link to="/dashboard" className="btn-secondary">Open dashboard</Link>
          </div>
        }
      >
        The page you were looking for does not exist or has moved.
      </EmptyState>
    </Card>
  )
}
