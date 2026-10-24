# NOC Manager v3 Design

## Goal

Release NOC Manager 3.0 with a clear company model, one-CID Data Center work, list-first master data, usable evaluation setup, and a compact logo theme control.

## Company model

- A Customer is global and is never duplicated because it buys from more than one company.
- Every Service/CID has one `serviceCompany`: `ION` or `SDC`.
- `PRODC` is accepted as a legacy alias and normalized to `SDC`.
- Employee evaluation placement is derived from department for now: `NocDatacenter` is `SDC`; every other eligible department is `ION`.
- A Data Center ticket can therefore represent an ION-owned CID executed by SDC without changing the customer or service owner.

## Data Center work

- Data Center is a service-work operation and requires exactly one existing CID.
- Initial work types are cable installation, rack installation, cross connect, port activation, device relocation, hands and eyes, power work, and Data Center termination.
- The selected CID supplies customer, service, site and service company. Assignment to NocDatacenter supplies executor company SDC.
- The form captures RFS plus structured work details. Resolve records completion history but does not mutate the subscribed product or capacity.

## Settings information architecture

- Master Data: Products/Services, Service Work Types, Symptoms & Causes, Job Categories.
- Operations: Workflows.
- Evaluation: automatic placement, policy/weights, manager access.
- System: multi-company routing and technical configuration.
- CRUD pages are list-first. Create/edit forms open only on explicit action.

## Evaluation bootstrap

- Admin can run an idempotent placement synchronization.
- It creates current open-ended assignments from each user's department and role using the fixed ION/SDC rule.
- Existing assignments are preserved; conflicts are reported instead of overwritten.
- The evaluation screen explains missing policy/evidence separately from missing placement.
- Scores remain unavailable rather than zero until a published policy and sufficient evidence exist.

## Navigation and presentation

- Settings navigation uses the four groups above.
- The text Light/Dark switch becomes the ION logo; its accessible label and tooltip describe the resulting theme.
- Application version is `3.0.0`.

## Release safety

- Database additions are backward compatible and applied before the new image.
- Deployment records the previous image and provides a rollback script.
- Rollback of the application does not require dropping the added nullable/defaulted data.
