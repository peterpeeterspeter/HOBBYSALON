import { Spinner } from "@medusajs/icons"
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

const AUTH_TOKEN_KEY = "medusa_auth_token"

export const LoginCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get("token")?.trim()

    if (!token) {
      setError("Geen geldige sessie ontvangen. Probeer opnieuw via Hobbysalon.")
      return
    }

    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    navigate("/orders", { replace: true })
  }, [navigate, searchParams])

  if (error) {
    return (
      <div className="bg-ui-bg-subtle flex min-h-dvh w-dvw items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-ui-fg-base mb-4">{error}</p>
          <a href="/login" className="text-ui-fg-interactive underline">
            Terug naar inloggen
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-ui-bg-subtle flex min-h-dvh w-dvw items-center justify-center">
      <Spinner className="text-ui-fg-interactive animate-spin" />
    </div>
  )
}
