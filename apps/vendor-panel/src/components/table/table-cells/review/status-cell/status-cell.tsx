import { StatusCell as StatusCell_ } from "../../common/status-cell"

type StatusCellProps = {
  status: string | null
}

export const StatusCell = ({ status }: StatusCellProps) => {
  return (
    <div className="flex h-full w-full items-center overflow-hidden">
      <span className="truncate">
        <StatusCell_ color={!status ? "orange" : "green"}>
          {!status ? "Wacht op antwoord" : "Beantwoord"}
        </StatusCell_>
      </span>
    </div>
  )
}

export const StatusHeader = () => {
  return (
    <div className="flex h-full w-full items-center">
      <span className="truncate">Status</span>
    </div>
  )
}
