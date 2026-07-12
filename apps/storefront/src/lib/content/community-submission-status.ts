export type CommunitySubmissionStatus = "pending" | "approved" | "rejected" | "withdrawn";

export type CommunitySubmissionStatusCopy = {
  label: string;
  detail: string;
  canWithdraw: boolean;
};

export function getCommunitySubmissionStatusCopy(
  status: CommunitySubmissionStatus
): CommunitySubmissionStatusCopy {
  switch (status) {
    case "pending":
      return {
        label: "In afwachting van beoordeling",
        detail: "Je project is ingediend en wacht op beoordeling.",
        canWithdraw: true,
      };
    case "approved":
      return {
        label: "Goedgekeurd en zichtbaar",
        detail: "Je project wordt getoond in de communitygalerij bij dit artikel.",
        canWithdraw: true,
      };
    case "rejected":
      return {
        label: "Niet goedgekeurd",
        detail: "Je project is niet opgenomen in deze communitygalerij.",
        canWithdraw: false,
      };
    case "withdrawn":
      return {
        label: "Inzending ingetrokken",
        detail: "Je project wordt niet meer getoond bij dit artikel.",
        canWithdraw: false,
      };
  }
}
