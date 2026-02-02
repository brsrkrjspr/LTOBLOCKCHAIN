# Strict Paper Alignment Implementation Plan
**Objective:** Align the technical implementation strictly with the "TrustChain" Capstone Paper (Chapter 3: Research Methodology & Chapter 6: Security and Governance).

## 1. Core Requirement: Three-Node Consortium (Critical)
**Paper Citation:**  
> "The blockchain network is deployed as a **three-node consortium**... Each node corresponds to a participating organization (LTO, HPG, Insurance) and hosts a peer that maintains a complete copy of the distributed ledger." (Chapter 3, Section 5.4)

**Current Gap:**  
The running network is currently effectively a "Single Organization" (LTO-only) bootstrap to fix certificate errors. The HPG and Insurance peers are defined in `docker-compose.yaml` but are not actively participating due to missing crypto material.

**Strict Solution:**
We must **re-enable** the full 3-Org network. This is non-negotiable for "Strict Alignment".
1.  **Generate Certificates** for HPG and Insurance using `cryptogen` or Fabric CA.
2.  **Join Peers to Channel**: Ensure `peer0.hpg.gov.ph` and `peer0.insurance.gov.ph` are joined to `ltochannel`.
3.  **Endorsement Policy**: Update chaincode endorsement to require LTO + (HPG or Insurance) for final approval, matching the governance model.

## 2. Core Requirement: Role-Based Endorsement
**Paper Citation:**  
> "The HPG peer endorses transactions by confirming that vehicles... are not reported as stolen... Insurance verification is treated as a prerequisite condition... using a simulated role." (Chapter 6, Section 6.1)

**Strict Solution:**
1.  **HPG Peer**: Must have its own MSP (`HPGMSP`). The application must invoke the HPG peer for "Clearance" transactions.
2.  **Insurance Peer**: Must have its own MSP (`InsuranceMSP`).
3.  **LTO Peer**: Validates final registration (`LTOMSP`).

## 3. Core Requirement: CSR as "Pre-Minted" Baseline
**Paper Citation:**  
> "...CSR derived information is initialized as **baseline vehicle records**... ownership status marked as UNASSIGNED." (Chapter 2, Section 2.7)

**Strict Solution:**
1.  **Maintain "Minted" Status**: Continue using the `MINTED` status for new vehicles.
2.  **No Dealership Node**: Explicitly **exclude** a dealership org. The system *starts* with LTO admin minting the vehicle (simulating the API feed from manufacturers), exactly as implemented.

## 4. Modified Implementation Roadmap (Strict Mode)

### Step 1: Crypto Generation (The "Fix")
We cannot run a 3-node network without 3 sets of certificates.
- **Action**: Run a script to generate crypto-config for `HPG` and `INSURANCE` organizations.
- **Why**: To fix the `ENOENT` errors that forced us into single-org mode.

### Step 2: Full Network Boot
- **Action**: Restore `network-config.json` to include all 3 organizations.
- **Action**: Start `docker-compose.unified.yml` with ALL peers active.

### Step 3: Channel Join
- **Action**: Execute `peer channel join` for HPG and Insurance peers.
- **Action**: Update Anchor Peers for all 3 orgs.

### Step 4: Chaincode Verification
- **Action**: Install `vehicle-registration` chaincode on **ALL 3 PEERS**.
- **Action**: Approve chaincode definition for **ALL 3 ORGS**.
- **Action**: Commit chaincode with policy: `AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))` (or similar governance rule).

## 5. Summary of Divergence
| Feature | Strict Paper Requirement | Current "Quick Fix" State | Action Required |
| :--- | :--- | :--- | :--- |
| **Topology** | 3 Organizations (LTO, HPG, Insurance) | 1 Organization (LTO) | **Generate Certs & Join Peers** |
| **Peers** | 3 Physical/Logical Peers | 1 Active Peer | **Start HPG/Insurance Containers** |
| **Endorsement**| Consensus across organizations | LTO Self-Endorsement | **Update Endorsement Policy** |
| **CSR** | Pre-Existing / Unassigned | Pre-Existing / Unassigned | **Keep (Aligned)** |

**Conclusion:**
To strictly reflect the paper, we must move out of the "Single-Org Debug Mode" and properly instantiate the HPG and Insurance nodes. This requires fixing the missing certificate issue properly (by generating them) rather than bypassing it (by removing the orgs).





Raw Paper:

TrustChain: Revolutionizing Vehicle Registration with Blockchain Technology

A Capstone Proposal
Presented to
the CITEC Department
UNIVERSITY OF BATANGAS LIPA CITY
Lipa City, Batangas

In Partial Fulfillment
of the requirements for
CAP101

Submitted by:
Besmar, Kim Andrei M.
Dulla, Jasper Dave C.
Latag, Joshua Ivan G.

Submitted to:
Dr. Mayling Iligan-Capuno


ACKNOWLEDGEMENT

The completion of this capstone project, TrustChain: Revolutionizing Vehicle Registration with Blockchain Technology, is the culmination of immense effort and support from numerous individuals and institutions. We wish to acknowledge them with our deepest gratitude.

First and foremost, our profound thanks to the Almighty God, whose continuous blessing and guidance provided the strength and clarity of mind necessary to navigate the complex challenges of this study.

We are deeply indebted to our distinguished adviser, Mr. Aldwin Sumalabe, for his exceptional technical expertise and patient mentorship. His insights into blockchain architecture and commitment to methodological rigor were critical in shaping the design and successful development of this system.

We thank the entire academic community of the University of Batangas – Lipa City and the CITEC Department for instilling in us the foundational knowledge and for providing the environment that nurtured this research.

Our sincere appreciation goes to the Land Transportation Office (LTO) in Lipa City, for providing the essential context and motivation for a system focused on efficiency and transparency, directly aligning our efforts with the local SMART City initiatives.

Finally, to our families, whose sacrifices, unconditional love, and constant encouragement were the most significant source of motivation.




Abstract
The Land Transportation Office (LTO) vehicle registration process in the Philippines is hindered by a "transparency paradox," marked by inefficient paper-based workflows, prolonged transaction times, and a vulnerability to insider fraud, such as "technical carnapping," which current digital reforms have not fully resolved. This study addresses the critical need for a secure, end-to-end validation framework by proposing the design, development, and evaluation of TrustChain, a permissioned blockchain-based system integrated with smart contracts.

TrustChain is designed to replace repetitive manual steps with automated, auditable digital workflows for owner-initiated registration and transfer of ownership in the LTO Lipa City District Office. Key features include secure, immutable storage of vehicle records (e.g., invoices, CSR, insurance hashes), smart contract functionality for automated compliance verification and multi-step approvals, real-time status tracking, and the generation of tamper-proof digital Official Receipts/Certificates of Registration (OR/CR). The system models a permissioned consortium of key stakeholders: the LTO, Philippine National Police–Highway Patrol Group (HPG), and insurance providers.

The study employed a developmental research approach, culminating in a pilot implementation evaluated against the ISO/IEC 25010 software quality model, focusing on criteria such as functional suitability, security, and usability. The project’s significance lies in providing a scalable and trustworthy solution that enhances operational efficiency, dramatically reduces the risk of document fraud and delays, and offers a concrete model for transforming digital governance and establishing public trust within the Philippine transportation sector.

Table of Contents
ACKNOWLEDGEMENT	1
Abstract	3
Table of Contents	5
CHAPTER 1	7
Introduction	7
Objectives of the Study	12
Significance of the Study	13
Scope, Limitations, and Delimitations	17
CHAPTER 2	22
Review of Related Literature	22
Chapter 3	33
Research Methodology	33
Chapter 4	55
Analysis and Presentation of Data	55
4.2 Post-Implementation Evaluation of TrustChain Based on ISO/IEC 25010	104
CHAPTER 5	118
SUMMARY, FINDINGS, CONCLUSIONS, AND RECOMMENDATIONS	118
5.4.1 Basis of the Comparative Analysis	121
5.4.3 Interpretation of Workflow Differences	123
5.4.4 Relationship to Technical Carnapping Cases Identified in Chapter 4	124
5.4.5 Implications of the Comparative Analysis	125
Appendices	129
Interview Letter	129
‎Pre Implementation Survey Form	131
ISO 25010 Evaluation Form	134
CURRICULUM VITAE	140
DEFINITION OF TERMS	155
References:	159





CHAPTER 1
Introduction
The pursuit of transparency, efficiency, and trust in public service delivery has long presented a paradox for government institutions. Citizens expect fast, reliable, and transparent transactions, yet the very bureaucracies tasked with providing these services often struggle under the weight of paper-based processes, fragmented systems, and institutional inertia. Scholars describe this as the “transparency paradox”, a condition in which the call for openness and accountability often produces more layers of paperwork and oversight, ironically slowing down the very processes it seeks to improve (Albu & Flyverbom, 2019). This paradox is most evident in highly transactional government services such as vehicle registration, where both regulatory compliance and service delivery must occur at scale.
Globally, governments have experimented with a range of digital reforms to address this paradox. Countries in the European Union and Oceania have explored harmonized standards and cross-border digital verification systems to simplify licensing and registration, though inconsistencies in implementation remain (Austroads, 2020; ACEA, 2022). Singapore offers a more mature example, having developed a comprehensive and highly structured importation and registration framework that ensures only roadworthy and compliant vehicles enter its system (LTA Singapore, 2024). These international experiences highlight a common theme: digitalization alone is not sufficient unless it is paired with robust verification protocols and regulatory alignment. In short, modernization requires not only faster systems but also stronger assurances of authenticity and trust.

In the Philippines, the Land Transportation Office (LTO) illustrates the persistence of these challenges. While recent efforts have introduced digital tools such as the Online Document Submission Facility (ODSF) through the Land Transportation Management System (LTMS), these measures have not fundamentally resolved bottlenecks in validation and record-keeping. Investigations revealed insider collusion in “technical carnapping” cases, where district offices illegally retitled seized vehicles by canceling legitimate transfers and issuing duplicate certificates—an abuse of gaps in paper-based custody systems (Daily Tribune, 2025; Manila Bulletin, 2025). At the same time, everyday inefficiencies remain evident: queue-driven registration workflows still require citizens to spend hours in LTO offices, moving from counter to counter for redundant checks, with limited automation to reduce error or delay (Sablada & Borres, 2021; Yandug & Santos, 2020). Compounding this, dealerships have repeatedly failed to release license plates and official receipts within mandated timeframes, prompting the LTO to issue nearly 4,000 show-cause orders in 2024 alone (Philippine News Agency, 2023). Collectively, these cases show that the system suffers not from a lack of regulations, but from weak enforcement and outdated verification mechanisms.
This situation exposes a critical gap. Existing digital reforms in the LTO have improved front-end access but have not automated or secured back-end validation. Rules and timelines exist, but compliance monitoring is fragmented, and custody trails remain vulnerable to manipulation or delay. Without tamper-evident records and automated compliance checks, enforcement depends too heavily on manual audits and discretionary oversight, these are conditions that allow inefficiency, insider abuse, and citizen frustration to persist. What remains unaddressed is the need for a secure, end-to-end validation framework that ensures records cannot be altered without detection, that workflows move faster without sacrificing accountability, and that trust is embedded in the system itself rather than in individuals or paperwork.
Against this backdrop, blockchain has emerged as a promising solution. With its decentralized and immutable architecture, it provides a system where every state change is securely logged and transparently auditable. Smart contracts extend this capability by embedding business rules into the system itself, ensuring that compliance is not dependent on manual enforcement but is instead automated at the protocol level (Taherdoost, 2023). Global implementations, such as California’s initiative to digitize over 42 million car titles on a blockchain network, illustrate how the technology can be deployed at scale to streamline title transfers and reduce fraud (CoinDesk, 2024). These cases demonstrate that blockchain is no longer a speculative concept but a tested model for solving inefficiency and integrity issues in vehicle registration.
The current Land Transportation Office (LTO) vehicle registration process remains hampered by inefficiencies that directly burden the public. Citizens continue to face long queues, repetitive submissions, and counter-to-counter handoffs that consume entire days. Even with the introduction of the Land Transportation Management System (LTMS) and its online facilities, these reforms have not resolved back-end issues in validation and record-keeping. The system still depends heavily on paper-based custody trails, leaving it prone to delays, errors, and reliance on manual verification. Instead of streamlining services, these gaps sustain inefficiency, create avenues for fixers, and gradually weaken public confidence in the government’s ability to deliver transparent and predictable service
The persistence of insider manipulation further underscores the fragility of current processes. In 2025, the LTO opened investigations into at least 40 district offices for “technical carnapping,” where officials allegedly canceled prior transfers and issued duplicate certificates of registration to illegally retitled vehicles(Manila Bulletin, 2025) (Philstar, 2025). Such cases highlight that reforms focused solely on digital access points cannot address the deeper challenge of tamper-prone validation mechanisms. Without an immutable audit trail or automated checks, the system continues to rely on discretionary oversight that can be exploited. For citizens, especially those with limited time and resources, the consequences are tangible: extra transport costs, wasted hours away from work, stress, and difficulty navigating requirements scattered across different offices
These challenges become even more pressing in Lipa City, where development plans explicitly emphasize SMART City initiatives. Paper-centric and delay-prone workflows are increasingly out of step with modernization goals, creating a gap between citizens’ expectations of digital governance and the reality of outdated bureaucratic practices. At its core, the problem is that there is no secure, automated validation framework that ensures both efficiency and accuracy while reducing the need for manual processing. What is missing is a tamper-evident, machine-verifiable mechanism that shortens ownership-transfer and registration cycles while embedding accountability across stakeholders
To address these conditions, this study proposes a permissioned blockchain-based registration system that integrates smart contracts and off-chain storage. Such a system is designed to replace repetitive manual steps with automated workflows, providing immutable history, role-based access, and real-time status tracking. By doing so, the registration process can shift from a paper-heavy sequence of checks into a secure, auditable, and efficient digital workflow. Beyond technical upgrades, this approach reflects the broader societal demand for trust infrastructures where compliance is built into the system rather than enforced through human discretion.
For the researchers, the motivation to pursue this study arises not only from prior studies but also from personal encounters with the inefficiencies of the current system. Having experienced the frustration of long queues, repeated resubmissions, and the need to move from office to office, the team recognizes that the existing workflow consumes resources that ordinary citizens cannot afford to waste. By situating the pilot in LTO Lipa, the project directly aligns with the city’s SMART City vision, showcasing how emerging technologies can be introduced locally as part of a larger modernization agenda. The initiative is pragmatic—targeting inefficiencies in validation and document management—but also aspirational, demonstrating that blockchain can serve as a concrete step toward transparent, citizen-centered governance.
Moreover, the urgency of reform is amplified by current public discourse. In 2025, multiple civil society groups demanded independent investigations into allegations of excessive corruption in Philippine infrastructure programs, reflecting a growing national appetite for governance systems that are tamper-proof and auditable(Reuters, 2025) (AP News, 2025). By embedding validation, transparency, and accountability into the registration process itself, this study not only addresses a localized operational problem but also resonates with wider societal calls for trustworthy digital governance.

Objectives of the Study
The main objective of this study is to design, develop, and evaluate the effectiveness of a blockchain-based vehicle registration system integrated with smart contracts for the Lipa City Land Transportation Office motor vehicle registration process.
To analyze the concepts of blockchain technology, smart contracts, and distributed ledger systems to understand their applicability in developing a secure and efficient vehicle registration platform that addresses current LTO operational challenges.
To develop a blockchain-based vehicle registration system with the following functions and features: 
Provide secure and immutable document storage for vehicle registration records, including sales invoices, Certificate of Stock Reported (CSR), and insurance documentation. 
Implement smart contract functionality for compliance verification, multi-step approval workflows, and payment workflow simulation.
Enable real-time status tracking and transparent audit trails for all registration transactions while maintaining data integrity and preventing document fraud. 
Generate tamper-proof digital OR/CR certificates with instant verification capabilities accessible to vehicle owners, law enforcement, and regulatory agencies.
To implement the blockchain platform as an integrated solution that connects multiple stakeholders, including vehicle owners, insurance companies, HPG, and LTO personnel, through a unified registration workflow.
To test and evaluate the blockchain-based vehicle registration system using ISO/IEC 25010 testing standard for software, with the following criteria: functional suitability, performance efficiency, compatibility, usability, reliability, security, maintainability, and portability.
To conduct a comparative analysis of the traditional paper-based LTO registration workflow and the proposed blockchain-integrated workflow, identifying structural differences in verification mechanisms, approval processes, and documentation handling that may influence processing efficiency.





Significance of the Study
The researchers believe that the study will be beneficial to the following:

Land Transportation Office (LTO)

The proposed blockchain-based vehicle registration system will go a long way to ensure the efficiency of the operations of LTO since it will have automated operations and minimal paperwork. Using the application, the LTO will be able to acquire real-time data as well as streamlined workflows that can enhance decision-making and service delivery. The digital OR/CR certificates, which will be fixed and tamper-proof, will help in increasing the credibility of LTO services at the end benefiting the overall trust of the people towards the functions of the government.

Vehicle owners and the General Public

The application allows vehicle owners to be notified automatically through email and SMS on document expiry and registration updates. The staff members will feel more secure to know that their enrollment information is safe in the network of blockchain. The uncertainty and frustration in the traditional methods of registration will be done away by the real-time status tracking.


Insurance Companies and Testing Facilities

The blockchain platform will develop a professional approach to interlinked customers of various stakeholders in the form of a common workflow. Test centers and insurance firms will enjoy automated verification of documents and have a low risk of fraud because the blockchain technology will create an indelible record of transactions made. The system will improve the arrangement between the service providers and LTO processes hence more delivery of services.

Academic and Research Community

The integrity of academic research on new technologies will receive a confidence boost through a reliable and stable blockchain system with tangible applications in the government sector. This research would be useful in any future blockchain application in government service and act as a basis of further research in other government agencies.

Technology Developers and IT Professionals

The study will have technical knowledge contributed to the integration of blockchain technology to the structuring of the current government systems and the handling of the issues that are complex. The exhaustive approach towards the testing could be used by other government agencies deploying a blockchain to create a blueprint on how to approach a similar implementation by giving technical requirements and guidelines to IT professionals on how to proceed.

Philippine Transportation Sector
The blockchain vehicle registration will also lead to the transformation of the transportation industry in the Philippines as it will form the basis of a digital transformation strategy. The study will show how blockchain technology can resolve some systemic problems like lack of transparency, document frauds and delays in the processes that has historically bedeviled the transportation industry.


Future Researchers
This study has explored the design, development, and evaluation of a blockchain-integrated vehicle registration system for the Land Transportation Office (LTO) in Lipa City, Batangas. While this research has demonstrated the potential benefits of distributed ledger technology for document integrity, process automation, and stakeholder transparency, several avenues remain open and ripe for further investigation While the current prototype demonstrates feasibility through simulated multi-organization participation and automated verification workflows, future implementations should explore active certificate issuance capabilities where participating organizations (HPG and insurance providers) generate and digitally sign certificates directly through the system. Integrating hotlist management for stolen and carnapped vehicles, enabling real-time certificate procurement through one-stop-shop interfaces, and implementing hash-based auto-verification of organizationally-issued documents would transform the system from a validation platform into a comprehensive service delivery ecosystem. Such enhancements would require expanded pilot testing with actual HPG clearance officers and insurance providers to evaluate operational workflows and inter-organizational coordination.

Scope, Limitations, and Delimitations
Scope defines the coverage of the study, what it will include and accomplish. Limitations describe the external constraints that the researchers cannot control, while delimitations are the intentional boundaries set by the researchers to focus the study within a manageable range. The following subsections present the scope, limitations, and delimitations of this capstone project on a blockchain-based vehicle registration system for the Land Transportation Office (LTO) in Lipa City.
This study focuses on the design, development, and pilot implementation of a blockchain-based vehicle registration system that demonstrates how owner-initiated registration and transfer workflows can be supported through cryptographically secured verification processes. The operational scope begins at the point where a Certificate of Stock Reported (CSR) has already been issued by accredited vehicle manufacturers, assemblers, or importers and registered with the Land Transportation Office in accordance with LTO Memorandum Circular No. 643-2005.
Under this regulatory framework, the CSR establishes vehicle identity—including VIN, engine number, chassis number, make, model, and technical specifications—prior to individual ownership assignment, creating a verified baseline of vehicle information in LTO records before the unit is sold. The proposed system treats CSR data as verified upstream input and does not manage CSR issuance or manufacturer compliance workflows.
The pilot concentrates on government-side verification processes during owner-initiated registration and transfer of ownership, specifically the validation stages where ownership claims are reviewed, approved, or rejected. Vehicle specifications derived from CSR records are represented in the system as pre-existing, unassigned vehicle entries, reflecting the current regulatory practice in which vehicle identity is established before ownership claims are processed.
The blockchain network is implemented as a permissioned consortium involving three participating organizations: the Land Transportation Office (LTO), the Philippine National Police–Highway Patrol Group (HPG), and insurance providers. Each organization is represented within the system through role-based access and controlled participation in transaction validation. The pilot is conducted in a controlled environment using test or properly redacted data and is intended solely to demonstrate technical feasibility rather than operational deployment.
The pilot also demonstrates verification of tamper-proof digital certificates of registration and official receipts, visible to vehicle owners and, in a read-only module, to law-enforcement or regulatory agencies. This module is distinct from regular user accounts because it enforces a separate, restricted role with limited capabilities. It returns only a verification status and a small set of certificate metadata that are safe to disclose, it exposes no editable fields and no sensitive personally identifiable information, and it requires authenticated access, which illustrates how external actors could safely consume blockchain-anchored proofs without the ability to alter records. 
Payment is represented through a placeholder mechanism rather than a live gateway. Users upload or view a mock proof of payment, for example a receipt image, to demonstrate where a payment record would enter the workflow. This is a deliberate design choice that shows integration points while avoiding exposure to financial, security, and legal risks that are outside the study. 
Original documents are stored off-chain in controlled storage, only cryptographic hashes and minimal metadata are recorded on-chain, documents are encrypted at rest, and access is restricted by role. User identities are provisioned by an administrative authority, and access is enforced both in the application and at the ledger layer through a membership service that uses certificate-based roles and supports revocation. The system accepts standard documents required for registration, renewal, and transfer, including invoices, certificates of stock report, sales documents, insurance certificates, deeds of sale, and official receipts or certificates of registration, in PDF and common image formats, for example PNG and JPEG. The web interface targets modern browsers on desktop and mobile devices and follows basic accessibility practices. The pilot operates with test or properly redacted data and keeps an auditable trail of interactions to support integrity and future review. 
The project is intentionally bound to demonstration scale and does not integrate with the national LTO production environment. It does not aim for nationwide throughput, high availability, or disaster recovery, and it does not include certification-grade audits. Instead, it will be evaluated against recognized software quality criteria such as functional correctness, usability, security, performance, and maintainability within the limits of academic research, which emphasizes feasibility and provides evidence for a digital workflow that can improve transparency and accountability in a single office setting and inform future refinements and potential expansion.

Delimitations 
	The pilot is geographically limited to the Land Transportation Office in Lipa City. It is implemented as a web-based application accessible through standard desktop and mobile web browsers. The system is designed for use in modern browsers and does not include dedicated native Android or iOS applications. All interactions occur within a controlled testing environment using test or properly redacted data. These constraints ensure consistency in evaluation and manageable deployment conditions.
The blockchain network operates as a permissioned environment to protect privacy and enforce institutional boundaries. Role-based access control differentiates permissions for Land Transportation Office personnel, Highway Patrol Group personnel, and insurance representatives. Access rights are defined according to organizational roles rather than individual discretion. Certificate of Stock Reported issuance remains outside the system’s scope and continues to be governed by LTO Memorandum Circular No. 643-2005. Vehicle identity information derived from CSR records is treated as verified upstream input for registration workflows.
Third-party stakeholders, such as insurance providers, are represented through simulated roles rather than live consortium integrations. Physical inspection processes conducted by enforcement units are not included in the pilot. Roadside law-enforcement verification activities are likewise excluded from the system. Inter-agency system integrations operate only at a conceptual or simulated level. These limitations allow the study to focus on core verification and approval workflows.
Functional coverage is limited to document integrity, auditability, role-based approval workflows, and ownership-related validation. The system excludes live payment gateways and financial transaction processing. Penalty enforcement mechanisms and nationwide license plate logistics are not part of the pilot. Biometric identity verification and registration renewal transactions are also excluded. Notification features are limited to basic system alerts rather than external communication channels.
System evaluation is conducted using the ISO/IEC 25010 software quality model at pilot scale. The assessment focuses on software quality characteristics relevant to controlled academic testing. Penetration testing and certification-grade security audits are not performed. Nationwide scalability and production-level performance testing are beyond the study’s scope. Organizational change-management and end-user training programs are also excluded from evaluation.
CHAPTER 2
Review of Related Literature
Global Modernization of Vehicle Registration
Across developed jurisdictions, significant efforts have been undertaken to modernize vehicle registration systems by embracing digitalization and harmonized regulatory frameworks. In a comparative study of practices in Australia, New Zealand, and the European Union, Austroads (2020) found persistent inconsistencies in identity verification, data-protection regimes, and digital adoption. The study highlighted that while some countries have integrated digital platforms to improve user experience, others continue to struggle with fragmented systems that hinder interoperability and efficiency. Similarly, the European Automobile Manufacturers Association (ACEA, 2022) emphasized that harmonized standards across regions such as the EU, United States, Canada, Japan, and China have been critical in facilitating international trade and ensuring more consistent compliance practices. Singapore, on the other hand, has institutionalized a step-by-step vehicle importation and registration process that mandates strict adherence to safety, emission, and technical requirements. According to the Land Transport Authority (LTA, 2024), these measures guarantee that only roadworthy and environmentally compliant vehicles are registered, underscoring the importance of robust regulatory enforcement. Collectively, these global experiences illustrate the dual importance of digital platforms and regulatory harmonization in achieving efficient and secure registration systems. They also demonstrate that modernization is not only a technological initiative but also a matter of aligning verification processes, standards, and oversight mechanisms.

Philippine Digital Registration
In the Philippines, the Land Transportation Office (LTO) has taken steps toward modernization through the implementation of digital platforms. The LTO Portal (2024) allows drivers to submit required documents online, including Compulsory Third-Party Liability (CTPL) insurance and the Motor Vehicle Inspection Report (MVIR). The portal also provides clear descriptions of timelines, administrative procedures, and penalties to improve regulatory compliance. These reforms have reduced reliance on hardcopy submissions and made compliance more convenient for vehicle owners. However, as YugaTech (2023) has noted, the system remains dependent on manual verification processes, limiting the impact of digitization and creating bottlenecks in application processing. This suggests that while digital access points have been introduced, the back-end workflows remain constrained by traditional practices, preventing full efficiency gains.

LTO Registration Timelines
Complementing these digital initiatives, the LTO announced a seven- to eleven-day processing window for the release of Official Receipts (OR), Certificates of Registration (CR), and license plates following the purchase of a vehicle. According to YugaTech (2023), this streamlined sequence involves five steps—purchase, preparation, dispatch, delivery, and receiving. Penalties are imposed on dealerships that fail to meet the mandated timelines. Yet despite this structured procedure, delays continue to frustrate vehicle owners, with many waiting beyond the stipulated period due to backlogs and uneven compliance. The persistence of these delays reflects the gap between policy design and operational execution, highlighting that digitization without integrated validation mechanisms is insufficient to resolve systemic inefficiencies.
Certificate of Stock Reported (CSR): Regulatory Foundation for Vehicle Identity
The Certificate of Stock Reported (CSR) is a required regulatory document in the Philippine vehicle registration system that establishes vehicle identity prior to individual ownership. Under LTO Memorandum Circular No. 643-2005, accredited manufacturers, assemblers, and importers are mandated to issue a CSR for each motor vehicle unit in their inventory, with each CSR issued only once per vehicle. The CSR records essential technical details such as the vehicle identification number (VIN), engine number, chassis number, make, model, and other specifications, which are submitted to the Land Transportation Office (LTO) before the vehicle is sold to an end user.
In practice, the CSR functions as the official reference point for validating vehicle identity during initial registration. When an individual applies for vehicle registration, the LTO cross-checks the submitted CSR against its records to confirm that the declared vehicle specifications correspond to an existing and valid stock entry. This process ensures that only vehicles with verified technical identity are eligible for ownership registration. As described in the LTO Portal (2024), CSR verification is a prerequisite step before ownership information is recorded and registration documents are issued. The CSR therefore serves as a foundational control mechanism that separates vehicle identity establishment from subsequent ownership transactions within the registration process.

Record-Integrity Risks and Insider Abuse (“Technical Carnapping”)
In mid-2025, the LTO launched probes into 40 district offices over illegal ownership transfers of police-seized vehicles—cases dubbed “technical carnapping.” Reports indicate that officials in implicated offices canceled prior transfers and issued duplicate Certificates of Registration to make unauthorized retitling appear valid, with clusters of cases reported by region (e.g., multiple incidents in CARAGA). The LTO has issued show-cause orders and vowed administrative and criminal action against those involved. These incidents have exposed weak cross-checks and paper-based custody updates, allowing insider manipulation of records to pass as legitimate changes. For the researchers, this has strengthened the premise that a secure, append-only trail of state changes is required to protect ownership histories against both external falsification and insider collusion (Daily Tribune, 2025; Philstar, 2025; Inquirer, 2025; SunStar, 2025; Manila Bulletin, 2025; LTO, 2025).

Chronic Queue-Driven Workflows and Manual Validation
Local studies have documented how registration at LTO branches has remained queue-dependent and paper-intensive, resulting in day-long visits, repeat appearances, and persistent dissatisfaction. Empirical analyses show that limited counters, serial counter-to-counter handoffs, and manual checks have prolonged turnaround times and encouraged reliance on “fixers.” In effect, the system has optimized for processing paper rather than verifying truth, so edge cases (e.g., name mismatches, unclear scans) escalate into multi-visit resolutions. For the researchers, these findings have underscored that the binding constraint is not the absence of rules but the absence of end-to-end, machine-verifiable validation that shortens ownership-transfer cycles (Sablada & Borres, 2021; Yandug & Santos, 2020).

Delays in OR/CR and Plate Release from Dealerships
Despite explicit timelines, dealerships have repeatedly failed to release the Official Receipt (OR), Certificate of Registration (CR), and plates within the prescribed window. In 2024, the LTO issued nearly 4,000 show-cause orders to dealers for late OR/CR or plate release, and earlier actions also penalized dealers for delayed registrations. On the ground, plates have remained in dealerships’ custody and buyers have waited beyond the stated 7–11 business days, revealing gaps in tracking, case escalation, and proof-of-delivery. For the researchers, this pattern has highlighted the need for a tamper-evident issuance chain with automated compliance monitoring to shorten release cycles and deter non-compliance (LTO, 2024; Philippine News Agency, 2023; Manila Bulletin, 2024).


Blockchain Technology
Blockchain technology has represented a fundamental change in how digital information is transmitted, verified, and stored. Sultan et al. (2018) defined blockchain as “a decentralized, cryptographically linked, append-only sequence of records replicated across a peer-to-peer network, governed by a consensus protocol.” This highlights three essential attributes—immutability, decentralization, and transparency—that replace centralized trust with distributed verification. Afzal and Asif (2019) further emphasized that once recorded, blockchain entries cannot be altered retroactively, ensuring auditability and trustworthiness in legal and administrative frameworks.
Ethereum
Ethereum has provided a foundation for deploying smart contract applications. Buterin (2016) introduced Ethereum as a next-generation blockchain designed not only for cryptocurrency but also for decentralized applications. Its Ethereum Virtual Machine (EVM) enables Turing-complete scripting, which allows complex business logic to be automated and executed transparently. Huertas et al. (2018) discussed Ethereum’s potential for hybrid blockchain models, where sensitive data can be shielded under permissioned controls while retaining public verifiability. This adaptability has made Ethereum suitable for enterprise applications requiring both compliance and flexibility.
Hyperledger Fabric
Hyperledger Fabric, developed under the Linux Foundation, is a permissioned blockchain framework tailored for enterprise and government use. Unlike public blockchains, Fabric allows organizations to define access rights, employ modular consensus protocols, and integrate with existing identity systems. Androulaki et al. (2018) described Hyperledger Fabric as a distributed operating system for permissioned blockchains, highlighting its modular design for scalability and security. Rosado et al. (2019) further applied Fabric in government service prototypes, demonstrating that it can balance decentralization with regulatory oversight. Locally, Pulmano et al. (2023) implemented Hyperledger Fabric to create a decentralized credentialing system for participatory governance in the Philippines, confirming its adaptability for secure government applications. Likewise, the Bangko Sentral ng Pilipinas selected Hyperledger Fabric for Project Agila, its pilot wholesale central bank digital currency initiative, underscoring its suitability for regulated environments (BitPinas, 2023).
Smart Contracts
Smart contracts extend blockchain’s functionality by embedding automated, self-executing rules into the ledger. Taherdoost (2023) emphasized that smart contracts reduce human error and minimize dependence on intermediaries by enforcing contract clauses automatically. Verde and Ganiron (2024) highlighted their application in Philippine government projects, where automation has improved transparency and accountability by replacing manual compliance processes with algorithmic verification. As such, smart contracts have been recognized as a powerful tool for improving efficiency in bureaucratic workflows.
Operational Context of LTO Registration Process
	To contextualize the procedural flow of initial vehicle registration in the Philippines, informal consultation was conducted with LTO staff during pilot testing. The consultation revealed that current verification processes rely on manual comparison of Vehicle Identification Numbers (VIN) across submitted documents, including CSR, insurance certificates, and HPG clearance. Staff noted that verification delays occasionally occur due to discrepancies in manually-entered VIN data from external agencies. The consultation also clarified that the persistence of the legacy Stradcom system alongside the newer LTMS platform stems from operational differences in how applications are submitted and routed for processing. These insights informed the system design and validated that the prototype accurately represented actual LTO verification workflows. This contextual information supported system development but was not treated as primary research data requiring separate qualitative analysis.


2.2 Related Studies
Several studies have explored the integration of blockchain technology in vehicle registration and other government-related processes. Malintha et al. (2024) examined Sri Lanka’s manual registration system and identified issues of fraud, inefficiency, and lack of transparency. They proposed a blockchain-based registry using Ethereum that automated core processes such as ownership transfer and certificate issuance, ensuring immutability of records and reducing processing time. Similarly, Rosado et al. (2019) demonstrated the potential of Hyperledger Fabric for government services, noting that a permissioned blockchain could balance decentralization with regulatory oversight by controlling participation and ensuring compliance with policies.
Practical adoption has also been documented internationally. In 2024, the California Department of Motor Vehicles implemented blockchain technology to digitize approximately 42 million vehicle titles using the Avalanche platform (CoinDesk, 2024; Arianee, 2024). This initiative reduced title transfer delays, minimized fraud, and improved citizen services, showing that blockchain systems can be deployed at national scale while maintaining efficiency and security.
Locally, Philippine government agencies have started experimenting with blockchain applications. The Department of Information and Communications Technology (DICT, 2022) proposed the use of blockchain for digital identity and land titling, while the Bangko Sentral ng Pilipinas piloted Project CBDCPh, a wholesale digital currency initiative based on distributed ledger concepts. The Land Registration Authority has also considered blockchain for authenticating land titles. These local efforts reflect a growing recognition of blockchain as a viable technology for public sector services and provide a foundation for its potential application in vehicle registration.




2.3 Synthesis of the Review of Related Literature and Studies
The reviewed literature and studies collectively demonstrate that inefficiencies, manual procedures, and fragmented verification remain common in vehicle registration systems worldwide. International reforms, such as the California DMV’s blockchain initiative and Sri Lanka’s prototype, confirm that blockchain can streamline ownership validation, reduce paperwork, and enhance trust in registries. At the same time, local discussions on the Philippine Land Transportation Office (LTO) highlight persistent delays, reliance on paper-based documentation, and multi-step ownership validation processes that frustrate citizens and sustain opportunities for inefficiency.
While global cases show that blockchain has already been applied to solve bottlenecks in registration and validation, the Philippine context remains different. Existing digital initiatives of the LTO, such as online submission portals, have introduced partial improvements but continue to depend on manual authentication and fragmented workflows. Unlike other countries that have piloted blockchain specifically for vehicle ownership, the Philippines has yet to implement such systems, leaving a gap between ongoing inefficiencies and the potential of distributed technologies.
For the researchers, these findings affirm the need to rethink how vehicle registration is managed, particularly in Lipa City, where LTO offices continue to rely on labor-intensive processes. The synthesis of international and local works makes it clear that the challenge in the Philippines is not primarily fraud but efficiency and validation, with fraud prevention emerging only as a secondary benefit of more transparent and automated systems. This distinction grounds the present study’s focus: to design and develop a blockchain-based registration system that simplifies ownership validation, reduces manual steps, and contributes to faster and more reliable transactions.
Taken together, the reviewed literature and studies highlight a persistent gap between existing vehicle registration practices in the Philippines and the capabilities offered by emerging digital technologies. While international implementations demonstrate that blockchain-based systems can improve efficiency, transparency, and ownership validation, local LTO processes remain characterized by manual verification, fragmented workflows, and delayed document release. This gap underscores the need for a system-level approach that emphasizes automated validation and tamper-evident record management rather than incremental digitization alone. In this context, the present study is positioned to explore the feasibility of a blockchain-based vehicle registration system that addresses operational inefficiencies and supports more reliable ownership verification within the Lipa City setting.


Chapter 3
Research Methodology
Research Design
This study employed Developmental Research (DDR) as its guiding framework. Developmental research emphasizes the systematic design, implementation, and evaluation of an artifact to address real-world problems while contributing to theoretical understanding (Ibrahim, 2016; Richey & Klein, 2007). In this study, the artifact is a blockchain-based vehicle registration system that integrates smart contracts and off-chain storage to address inefficiencies and validation challenges within the Land Transportation Office (LTO). DDR was chosen because it allows the researchers to align the system’s design and development with stakeholder needs while maintaining academic rigor. Unlike traditional project-based implementations, DDR treats system creation as a research process, documenting design decisions, challenges, and evaluation outcomes to generate insights about what works in practice (McKenney & Reeves, 2019).
To complement this design, the researchers adopted Agile practices under the Software Development Life Cycle (SDLC). The iterative nature of Agile supports the flexibility and responsiveness of DDR, ensuring that the prototype is refined through cycles of design, testing, and feedback. This combination allowed the study to balance its practical goal of building a functional blockchain-based registration system with its scholarly aim of contributing to the discourse on blockchain applications in government services.
Research Method
The research method of this study integrated Agile software development methodology within the Software Development Life Cycle (SDLC). Agile was selected because it complements the iterative nature of developmental research by prioritizing stakeholder collaboration, continuous improvement, and adaptability to emerging requirements (Ng, 2019; MDPI, 2019). Organizing Agile under the SDLC framework ensured that the development process followed a structured sequence of phases, consistent with established practices in academic capstone projects (Gray, 2020). This combination allowed the researchers to build a functional system while maintaining methodological rigor.

Figure 1. Agile Development
Phase 1: Requirements. The first phase involved gathering both functional and non-functional requirements from key stakeholders such as vehicle owners, registration officers, and system administrators. User stories were formulated to capture specific needs and expectations, while acceptance criteria were established to guide later testing. To ensure prioritization, the MoSCoW technique (Must have, Should have, Could have, Won’t have) was applied, and product and sprint backlogs were created to organize tasks and milestones (Ng, 2019).
Phase 2: Design. During the design phase, the researchers developed the system architecture and the blockchain network topology. User interface mockups and wireframes were produced to visualize workflows and interactions. At the blockchain level, the structure of chaincode (smart contracts) was designed with consideration for security patterns, modularity, and performance optimization. All technical specifications were documented to guide implementation and maintain traceability of design decisions (MDPI, 2019).
Phase 3: Development. Implementation began with the development of chaincode in Hyperledger Fabric using supported programming languages such as JavaScript and Go. Simultaneously, backend services were implemented in Node.js with Express, while frontend modules were developed using React.js. Security mechanisms, such as role-based access control and token-based authentication, were embedded during development rather than added post hoc, in line with best practices in Agile software engineering (MDPI, 2023). Each sprint delivered working functionality that was demonstrated to stakeholders for feedback.
Phase 4: Testing. Multiple levels of testing were conducted to ensure the system met both functional and non-functional requirements. Unit tests validated the correctness of individual modules, while integration tests ensured that subsystems worked together seamlessly. Security audits of the chaincode were conducted to identify vulnerabilities, and user acceptance testing was carried out with stakeholders to confirm that requirements were satisfied. This phase highlighted Agile’s emphasis on frequent verification and validation through collaboration with end users (Ng, 2019).
Phase 5: Deployment. Once verified, the system was deployed to a controlled environment within the LTO pilot context. The blockchain network was initialized with peer and orderer nodes, and chaincode was deployed to the ledger. The application services were launched on dedicated servers. Backup and recovery mechanisms were also established to maintain system 3.3resilience against unexpected failures (ScienceDirect, 2024).
Phase 6: Review. In the final phase, feedback was systematically gathered from users LTO staff. Surveys based on ISO/IEC 25010 were administered to measure software quality characteristics and gather user feedback. Performance logs and monitoring data were analyzed to identify bottlenecks or anomalies. Retrospective reviews were also conducted with the development team to reflect on the process and plan for refinements in subsequent iterations (McNeish, 2018).
Through these six phases, the Agile-SDLC approach ensured that the system was built in a flexible, iterative, and stakeholder-centered manner. It allowed the researchers to integrate technical requirements, user needs, and quality standards, resulting in a blockchain-based vehicle registration system that aligns with both practical objectives and academic research goals.
3.3 Data Gathering Instruments
To evaluate the effectiveness of the proposed blockchain-based vehicle registration system, the researchers employed a combination of quantitative and qualitative instruments. The primary instrument was a structured survey questionnaire designed based on the ISO/IEC 25010 software quality model. According to Canlas et al. (2021), this framework provides a comprehensive means of evaluating software across eight quality characteristics: functional suitability, performance efficiency, compatibility, usability, reliability, security, maintainability, and portability. The questionnaire was divided into sections aligned with these characteristics, using a four-point Likert scale to capture respondent perceptions while avoiding a neutral midpoint (PMC, 2021).
3.4 Data Gathering Procedure
The data collection followed a structured procedure consisting of two main phases: pre-implementation and post-implementation.
During the pre-implementation phase, baseline data on the current LTO registration process was gathered. This included stakeholder surveys to document pain points, such as long waiting times, verification bottlenecks, and document fraud risks, consistent with findings by Sablada and Borres (2021) and Meher et al. (2024). The researchers also collected processing time records and error logs from existing procedures to establish benchmarks for later comparison.
In addition to the administration of the survey questionnaire, an exploratory key-informant consultation was conducted with an LTO staff member to clarify the actual workflow of initial vehicle registration. The consultation was unstructured and exploratory in nature and was not subjected to formal qualitative analysis. Its purpose was limited to validating process assumptions used in system modeling and design, and it was not treated as a primary data source for the study.
In the post-implementation phase, evaluation was conducted after deploying the blockchain prototype in a controlled environment. Selected stakeholders participated in user testing sessions, where they interacted with the system to simulate real transactions. After sufficient exposure, the ISO/IEC 25010-based survey was administered to capture user feedback, with at least thirty respondents targeted to achieve statistical validity (PMC, 2018). 
To validate survey reliability, Cronbach’s alpha was computed for each section, with ≥0.70 considered acceptable for internal consistency (McNeish, 2018). Pilot testing of instruments was also conducted before full deployment to identify potential issues. This multi-phase procedure ensured that both the pre-existing problems and the improvements introduced by the system were rigorously assessed.





Technical Background
Blockchain
In this study, blockchain is adopted as the core trust layer for vehicle registration: a distributed ledger that records transactions in cryptographically linked blocks to produce a tamper-evident, time-ordered history shared by authorized participants (NIST, 2018). We specifically use a permissioned approach so that only vetted organizations in the process (e.g., LTO and accredited partners) can read, write, and endorse records within clearly defined roles and policies, which aligns with the governance and privacy needs of a public office. To operationalize this, the project employs Hyperledger Fabric v2.5, an enterprise blockchain framework under the Hyperledger project, because it provides membership management through the Membership Service Provider (MSP), policy-driven endorsement, and a modular ordering service, while executing business rules as smart contracts (“chaincode”)—all features that let us encode registration, and ownership transfer  as deterministic, auditable steps rather than manual discretion (Hyperledger Fabric Documentation, n.d.). In short, Fabric supplies the “how” through identities, policies, and chaincode on a controlled network, while the ledger itself supplies the “why” by guaranteeing an immutable audit trail that strengthens accountability and reduces opportunities for record tampering in a regulated workflow. 
Blockchain Platform
2.1 Hyperledger Fabric v2.5
The system is based on Hyperledger Fabric v2.5 which was selected as it allows for controlled membership and modular design, which is considered a permissioned blockchain. It is appropriate for regulated processes like that of registering vehicles,where LTO, HPG, and Insurance organizations participate in the process. Fabric's modularity gives the team the capability to simulate a consortium with limited resources and ensures accountability and tamper-proof.
2.2 Raft Consensus
The ordering service uses Raft, which was chosen because of two key properties - deterministic finality, and crash-fault tolerance. Such a consensus method will guarantee that all transactions take a reliable and predictable sequence so that there will be fewer risks of inconsistent records. By utilising Raft, the system remains stable even if there are partial node failures, which is important in the workflow of governments.
2.3 Membership Service Provider (MSP)
MSP (managed service provider) of Fabric which takes care of digital identities and enforces role-based permissions. This was selected due to there being multiple actors: a) User / Vehicle Owner, b) LTO staff, c) HPG staff, d) Insurance verifier needed to be able to operate with defined responsibilities. The MSP provides accountability of checking roles before granting access or approvals.
2.4 Smart Contracts (Chaincode)
Business rules are translated to chaincode written in the JavaScript/TypeScript language. This decision was made in order to automate some basic actions such as registration, renewal, and ownership transfers to reduce human error. By having the actual sense of logic embedded right into the ledger and also making it fairly transparent, it supports the system of rightness, transparency, and compliance.
2.5 State Database (CouchDB)
CouchDB is used instead of registration metadata's rich queries at CouchDB's state database. It was adopted so that the administrators would be able to search for, filter, and report without scanning the entire ledger. This is done in order to improve efficiency while maintaining the immutability of the blockchain.
2.6 Off-Chain Storage (IPFS)
IPFS is utilized for large documents like invoices, deeds of sales and emission tests. The reason behind this choice is that blockchain is not built for bulky files but anchors of these files can be anchored to blockchain. This technique provides authenticity, but with light-weight, as well.
2.7 CSR-Derived Pre-Registration Vehicle Records and Baseline Data
A key architectural feature of the system is the representation of vehicles as ledger records that exist prior to individual ownership assignment. This design reflects the regulatory role of the Certificate of Stock Reported (CSR), which establishes vehicle identity independently of ownership. While CSR issuance by manufacturers and importers remains outside this system's scope, CSR data that has already been issued and registered with LTO is used as the foundation for vehicle identity within the blockchain network. The system does not create or issue CSRs; rather, it accepts pre-existing CSR information as authenticated input and records it as immutable baseline vehicle records.
Under LTO Memorandum Circular No. 643-2005, accredited manufacturers, assemblers, and importers submit CSR documentation to the Land Transportation Office for each vehicle unit before it is sold. These submissions create a verified record of technical specifications—such as VIN, engine number, chassis number, and make and model—that persists regardless of who later acquires the vehicle. In the system, CSR-derived information is initialized as baseline vehicle records through an administrative bootstrap process, resulting in ledger entries that represent vehicles awaiting ownership registration.
When initialized, a vehicle record contains core identifying attributes and an ownership status marked as UNASSIGNED, indicating that no ownership claim has yet been recorded. An illustrative representation of this ledger state is shown below:
{
  "assetType": "Vehicle",
  "vin": "MHFCV1234567890XY",
  "engineNumber": "4G63-AB123456",
  "chassisNumber": "MHFCV-1234567890",
  "makeModel": "Toyota Vios 2024",
  "csrNumber": "CSR-2024-001234",
  "csrIssueDate": "2024-01-15",
  "ownershipStatus": "UNASSIGNED",
  "currentOwner": null,
  "registrationHistory": []
}

These records exist on the ledger before any owner-initiated transaction occurs. During initial registration, vehicle identification details submitted by an applicant are matched against existing UNASSIGNED vehicle records. Upon a successful match, the system updates the ownership status and records the change in the vehicle’s registration history, producing a traceable sequence of state transitions from identity establishment to ownership assignment.
This approach reflects existing CSR-based registration practice by separating vehicle identity from ownership while representing both as explicit ledger states. It demonstrates how ownership registration can be constrained to vehicles with pre-established technical identity records, with each transition recorded in a manner that supports auditability and verification within the system design.
Application Layer
 3.1 Backend
The backend is built up using Node.js and Express which was chosen because of its lightweight and event-driven architecture. It is the middleware layer that will take care of authentication and transaction management and also to communicate with Fabric SDKs. This ensures that the actions of the users are translated to blockchain transactions securely.
3.2 Frontend
The frontend is browser-based and was created using React or standard HTML, CSS and JavaScript. This decision has undergone the path to ensure maximal accessibility on both desktop devices and mobile devices without the need of native apps. By maintaining the web-based system, users can interact with the system easily by familiar browsing systems.
3.3 Transaction Flow
For instance, the transaction process starts by uploading data to IPFS, collecting the relevant hash and validating the prover or validator of the transaction by running the transaction through the specified known as chaincodes. The endorsed transactions are then introduced into a Raft, to propose for the ordering and the block creation. Once committed results are returned to the frontend thus providing users with real-time updates.
Security and Notifications
 4.1 Authentication
The system employs JSON Web Tokens (JWT) for user authentication to enable secure and stateless session management. JWT-based authentication supports scalability across distributed components by eliminating the need for server-side session storage. Users authenticate using registered email addresses and passwords, after which a signed token is issued and used to verify identity for subsequent requests. This approach aligns with distributed system requirements while maintaining secure access control.
4.2 Two-Factor Authentication (2FA)
To strengthen protection for sensitive operations, the system incorporates two-factor authentication (2FA) as an additional security layer. One-time verification codes are delivered via email or SMS during critical actions such as registration approval or ownership transfer. This mechanism reduces the risk of unauthorized access even in cases where account credentials are compromised. By requiring a second verification factor, the system enhances trustworthiness and protects high-impact registration transactions.
4.3 Role-Based Access
Role-based access control is enforced at both the application backend and blockchain chaincode levels. This dual-layer authorization ensures that only users with appropriate roles can initiate, approve, or modify transactions. Aligning backend permission checks with on-chain validation logic prevents unauthorized record modification and privilege escalation. The layered enforcement model provides resilience against insider misuse while maintaining consistency between application logic and ledger rules.
4.4 Notifications
The system integrates email and SMS notifications to provide timely updates on registration status, document approvals, expirations, and identified issues. These notifications reduce the need for repeated physical visits to LTO offices by keeping applicants informed throughout the registration process. Automated messaging improves transparency by ensuring that users receive consistent and traceable communication. As a result, notification mechanisms support both user convenience and procedural accountability.
Deployment and Tools
5.1 Hosting Environment
System deployment is conducted using DigitalOcean due to its affordability, reliability, and suitability for academic prototyping. The cloud environment enables remote accessibility and controlled scalability for testing purposes. This setup allows the researchers to simulate enterprise-style hosting conditions without incurring excessive infrastructure costs. Cloud-based deployment also supports monitoring and iterative system development.
5.2 Containerization
Docker, in combination with Windows Subsystem for Linux 2 (WSL2), is used to containerize system services and ensure consistent execution across different operating systems. Containerization simplifies installation, minimizes environment-related conflicts, and enables repeatable deployments. All Hyperledger Fabric components operate within containers, ensuring consistent behavior whether the system is deployed locally or in the cloud. This approach improves reliability and simplifies maintenance.

5.3 Development Tools
Git is used as the primary version control system to support collaborative development and change tracking. Visual Studio Code (VS Code) serves as the integrated development environment, providing extensions and debugging tools suitable for blockchain and web application development. Together, these tools enhance productivity, collaboration, and code quality. They also provide a stable environment for implementing and testing system components.
5.4 Network Topology
The blockchain network is deployed as a three-node consortium to represent a multi-organization environment while remaining resource-efficient for academic deployment. Each node corresponds to a participating organization and hosts a peer that maintains a complete copy of the distributed ledger, enabling transactions to be validated and recorded in a distributed manner. This configuration supports quorum-based operation, ensuring that transaction approval and ledger updates require participation from multiple nodes.
The three-node topology provides basic fault tolerance and availability by allowing the network to continue operating as long as a majority of nodes remain functional. Transaction ordering and block commitment are coordinated through a Raft-based ordering service, which requires agreement among participating nodes before updates are written to the ledger. While limited in scale, this deployment configuration is sufficient to demonstrate distributed validation and consortium-style governance within a controlled testing environment.
Security and Governance
6.1 Organizational Roles and Endorsement Responsibilities
The blockchain network operates as a three-organization consortium in which each participating institution is represented by a dedicated peer node that maintains a full copy of the distributed ledger. Each organization participates in transaction endorsement according to its institutional mandate, ensuring that validation authority is distributed across multiple stakeholders rather than centralized within a single entity.
The Land Transportation Office (LTO) functions as the primary regulatory authority within the network. Its peer node endorses registration-related transactions, validates submitted records, and serves as the final approval authority for both initial vehicle registration and ownership transfer workflows. This role reflects the LTO’s statutory responsibility for maintaining official vehicle records and overseeing the registration lifecycle.
The Highway Patrol Group (HPG), a unit of the Philippine National Police, participates in the network to support vehicle security verification. The HPG peer endorses transactions by confirming that vehicles involved in registration or transfer requests are not reported as stolen, carnapped, or associated with criminal activity. Clearance from the HPG is required before ownership-related transactions can proceed to final approval, mirroring existing vehicle verification procedures.
An insurance organization node represents the validation of Compulsory Third-Party Liability (CTPL) insurance coverage during registration transactions. This peer verifies the authenticity and active status of submitted insurance certificates as part of the endorsement process. Insurance validation is treated as a prerequisite condition for progressing registration workflows, ensuring that statutory coverage requirements are satisfied before records are finalized. In the pilot implementation, insurance verification was performed through automated database validation to demonstrate the verification workflow, with verified status displayed directly to LTO administrators. Future deployment would enable insurance providers to directly participate through dedicated organizational credentials and manual endorsement processes.


Hardware and Software Requirements
The successful implementation of the blockchain-based vehicle registration system requires specific hardware and software configurations. These requirements ensure optimal performance, security, and reliability of the system.
Table 1. Hardware Requirements
Component
Minimum Specification
Recommended Specification
Development  Workstation
Intel Core i3 processor, 8GB RAM, 500GB SSD, Standard keyboard and mouse
Intel Core i5/i7 processor, 16GB RAM, 256GB SSD, Ergonomic peripherals
Backup Storage
500GB external solid state drive
Cloud backup solution











Table 2. Software Requirements
Software Component
Description
Version Requirement
Github
Cloud-based platform for hosting repositories and enabling collaborative development
Latest (cloud-based)
Git
Local version control system to track and manage source code changes
2.34+
Visual Studio Code (VS Code)
Integrated Development Environment (IDE) with support for Node.js, Docker, and Fabric SDK extensions
1.96
Docker Desktop
Containerization tool for simulating blockchain nodes, CouchDB, and test environments
20+likert
Web Browsers (Chrome/Firefox)
Used to test and run the frontend web application during development
Chrome 90+, Firefox 88+


Statistical Treatment of Data
The researchers applied weighted mean as the primary statistical tool to analyze the responses from the ISO/IEC 25010-based survey questionnaire. The weighted mean was used to determine the overall level of user agreement for each software quality characteristic, based on a four-point Likert scale. The interpretation scale was as follows:
Likert Scale Option
Weighted Mean Range
Verbal Interpretation
1
1.00 – 1.75
Strongly Disagree
2
1.76 – 2.50
Disagree
3
2.51 – 3.25
Agree
4
3.26 – 4.00
Strongly Agree

To ensure the reliability of the survey instrument, the researchers computed Cronbach’s Alpha for each set of indicators. An alpha coefficient of 0.70 or higher was considered acceptable, while values above 0.80 indicated strong internal consistency (McNeish, 2018). This approach provided a systematic way of interpreting user perceptions and ensured that the data collected accurately reflected the quality characteristics being evaluated.
ISO/IEC 25010 Software Evaluation
The evaluation framework for this study was grounded in ISO/IEC 25010, which supersedes ISO 9126 and provides an updated model for assessing software product quality (Proceedings of CECIIS, 2022). This standard was selected because it comprehensively covers eight quality characteristics critical to government information systems.
The characteristics evaluated were: (1) functional suitability, (2) performance efficiency, (3) compatibility, (4) usability, (5) reliability, (6) security, (7) maintainability, and (8) portability. Each characteristic was measured using the ISO/IEC 25010-based survey instrument and validated through pilot testing and user feedback. By applying this internationally recognized framework, the researchers ensured that the blockchain-based vehicle registration system was rigorously assessed against both technical and user-centered dimensions.
The findings from this evaluation will determine whether the system meets quality benchmarks suitable for deployment in the Land Transportation Office and provide insights into areas requiring further refinement. In doing so, the study aligns with previous applications of ISO/IEC 25010 in evaluating government-oriented information systems (Canlas et al., 2021).















Chapter 4 
Analysis and Presentation of Data
This chapter of the study will show the analysis and presentation of the gathered data for the development of the TrustChain: Revolutionizing Vehicle Registration with Blockchain Technology
Conceptual Framework 

Figure 4.1 Conceptual Paradigm
Figure 4.1 introduces the conceptual framework of the study based on the Input Process-Output (IPO) model that explains the development path of the TrustChain system. The model starts with the identification of inputs, including the necessary areas of knowledge including blockchain technology, smart-contract development, and the incorporation of IPFS. These requirements are then balanced with specific software and hardware requirements, such as Node.js, PostgreSQL, and a server setup, which, when combined, form the technical core upon which the platform is built.



Flowcharts


Figure 4.2 TrustChain User New Registration and Transfer of Ownership

Figure 4.2 is the operational flowchart of the LTO Blockchain system. You are presented with a process that requires the user to login or register an account by verifying an email. Upon authentication, the user will be redirected to the Owner Dashboard to select either of the two services: (1) New Vehicle Registration or (2) Transfer of Ownership.

In the New Vehicle Registration category, the user uploads the necessary documents such as the OR/CR and ID, enters the details of the vehicle and the owner and submits the application upon a final check. Alternatively, the seller can also choose Transfer of Ownership, enter the email address of the buyer, choose a vehicle in their inventory, and upload the Deed of Sale. After submission, the system changes the status to submitted or pending and also informs the concerned parties through email to complete the process.





Figure 4.3 TrustChain Admin New Registration Approval

Figure 4.3 is the operational flow chart of the Admin review procedure in the system of LTO Blockchain. This is achieved when the Admin is allowed to log in to the system and view pending applications to be reviewed. The Admin also confirms the vehicle details and uploaded documents including the OR/CR and insurance when verifying necessary HPG or insurance clearances.


Once the Admin decides whether all the requirements are up to date, he or she goes further to approve or reject. In the case of approval (Path A), the Admin assigns OR/CR numbers, adds the vehicle to the blockchain and changes the status to REGISTERED. The system then creates an ID of a Blockchain Tx and informs the owner through email. On the other hand, a failure to meet the requirements (Path B) will cause the Admin to reject or resend the application to amend and change the status to REJECTED/RETURNED and informs the applicant.

















Figure 4.4 TrustChain Admin Transfer of Ownership Approval

Figure 4.4 is the operational flow chart of the Admin Transfer of Ownership module of the system LTO Blockchain. This is achieved through the Admin accessing the system to see and pick pending transfer applications to see. The Admin checks the seller and buyer information, checks the status of the vehicle, and authenticates the necessary documents, including the Deed of Sale, all IDs, TIN, CTPL and HPG Clearance.

The system checks to have a Motor Vehicle Inspection Report (MVIR) on the approval path; in case it exists (Path A), the Admin will check the validity of the same and approve the transfer. The blockchain is then updated with the transaction, vehicle ownership is transferred to the new owner, the status is changed to Completed, and the seller and the buyer receive notification through email. Alternatively, though, in the event that no record of inspection is located (Path B), the Admin is required to perform or automatically create an inspection and enter the findings. In the event of further failure by the application to pass verification, it is sent back or refused, and the process ends.







Figure 4.5 TrustChain HPG New Registration Approval

Figure 4.5 shows the HPG Clearance process operational flowchart in the system. The process starts by the HPG User entering into the Clearance and Verification Module. When the user receives a clearance request issued by LTO, he/she proceeds to review the vehicle information and documents to confirm the engine, chassis, and the macro-etching information.

In case the vehicle is cleared (Path A), the user approves the clearance, and changes the status to "APPROVED/COMPLETED" and has an option to update the verification on the blockchain. This is then communicated to the LTO that they can continue with the approval of the applications. Alternatively, in case the vehicle is not cleared (Path B), request is rejected, status is changed to that of REJECTED and LTO is informed of the outcome.

















Figure 4.6 TrustChain HPG Transfer of Ownership Approval

Figure 4.6 illustrates the HPG Ownership Transfer Verification flowchart. It commences with the HPG User entering the system as an administrator and the Transfer Clearance Module to accept the request relayed by the LTO. The officer inspects the vehicle and buyer paperwork and conducts physical verification of the engine, chassis, and stencils.

In cases where the vehicle is clear to transfer, the officer accepts the clearance and proclaims the status to APPROVED, and resubmits the request to the LTO under review to finalize. On the other hand, when the vehicle is not cleared, the officer refuses the application, changing the status to REJECTED and informing both the LTO and the applicant. Both deliveries terminate the HPG role in the verification loop.

Data Flow Diagrams

Figure 4.7 Level 0:  TrustChain Homepage Dashboard

Figure 4.7 represents the architectural model of the TrustChain application. It first outlines the Client Layer, whereby end-users are vehicle owners and officials at the Land Transportation Office and they communicate with the system through a web interface. The interactions then get relayed to the Application Layer which handles user authentication and process requests via a Node.js API server.

Then it moves to the layer of the Blockchain where smart contracts known as chaincode are executed to authenticate the data and a consensus mechanism is used to ensure that everyone is in agreement before the transaction is made in the distributed ledger. At the same time the IPFS Layer stores digital documents and provides a distinct cryptographic hash to the ledger in case they are to be verified. After the security of the data, the system provides a real-time update to the Client Layer. On completion the user session becomes terminated, otherwise the user may invoke another request.



Figure 4.8 Level 1:  TrustChain Homepage Dashboard
Figure 4.8, Data Flow Diagram (DFD) is that of the User module engaged in management of vehicle stocks. First, the system will require this step: the user will be asked to log in and access the dashboard, during which the user could choose to either add new inventory or check the current inventory. When choosing to add a new entry, the user will give the relevant information including Vehicle Identification Number (VIN), engine number, chassis number, and the category of the vehicle.

After data entry the system then allows uploading of digital documents i.e. CSR Certificate and Sales Invoice. After a user verifies the information and is satisfied by it, the system handles it by adding the details of the transaction to the blockchain registry. The resulting product of this process is the creation of a special Stock Identifier and blockchain validation, thereby making it traceable. Assuming that the user satisfies every requirement, the process is over; otherwise, the user can get to the dashboard and control more records.

Screenshots


Figure 4.9.1:  TrustChain Landing Page

Figure 4.9.1 displays the Home Page of the TrustChain application. It is the initial point of entry that lets users get a cursory overview of the system, which includes such features as secure vehicle registration and transparency supported by blockchain. It has well defined navigation buttons on the website such as the "Login" and the Sign Up buttons that lead the user to the corresponding portal.







Figure 4.9.2:  TrustChain Login Page

Figure 4.9.2 is the Login Page where registered users identify themselves. It requests the user to fill in his/her registered email and password. These credentials are checked in the database and then the system allows the user access to the particular dashboard to which they are granted access based on their role.




Figure 4.9.3:  TrustChain Sign-Up Page

Figure 4.9.3 displays the Sign Up Page of new members. It demands input of personal information, full name, email address and a secure password. After the user completes the form, the system will generate a new account and start a unique digital identity to be used in the blockchain network.

Figure 4.9.4:  TrustChain Owner Dashboard
Figure 4.9.4 introduces the Owner Dashboard that serves as the core point of vehicle owners. It shows an overview of what the user has done, shortcut links to initiating a New Registration or Transfer of Ownership and real-time updates on the status of applications awaiting action.








Figure 4.9.5:  TrustChain Owner My Vehicles
Figure 4.9.5 This screen contains all vehicles registered with the user. The main information, such as the plate number and model, is displayed in each entry and is taken straight out of the blockchain to guarantee the information is correct and up to date.









Figure 4.9.6:  New Registration
Figure 4.9.6 It consists of the step-by-step structure in which the user must fill in technical specifications of the vehicle (VIN, Engine Number) and attach the necessary certificates including the CSR and Insurance. This module automates the preliminary filing process prior to the transfer of the data to LTO review.




Figure 4.9.7:  Transfer of Ownership

Figure 4.9.7 This screen enables the current owner to choose a car among the list, enter the details of the buyer and upload legal documents such as the Deed of Sale. The system verifies the presence of all the necessary fields prior to the user submitting the transfer request to the blockchain.




Figure 4.9.8:  Transfer of Ownership

Figure 4.9.8, the "My Applications" page allows users to monitor the status of their pending requests. It displays the Transaction ID, the service of type, and the status at the moment (e.g., Pending, Approved, or Rejected) and gives complete transparency of the LTO and HPG verification process.








Figure 4.9.9:  Admin Landing Page

Figure 4.9.9 displays the main dashboard for the Land Transportation Office (LTO) administrator. The interface provides a high-level summary of the registry's status, displaying real-time metrics such as "Total Registered Vehicles," "Pending Transfers," and "Recent Activities." The sidebar navigation offers quick access to core modules including Vehicle Management, User Management, and the Blockchain Ledger.







Figure 4.9.10: Immutable Blockchain Ledger View

Figure 4.9.10 presents the Blockchain Ledger module. This screen visualizes the underlying Hyperledger Fabric network, displaying a chronological list of blocks. Each entry includes the Block Number, Channel Name (ltochannel), Transaction Count, and the cryptographic Data Hash.




Figure 4.9.11: Vehicle Ownership History (Provenance)


Figure 4.9.11 illustrates the Ownership Tracing feature. By entering a Vehicle Identification Number (VIN) or Chassis Number, the system generates a timeline view of the vehicle's history. The timeline explicitly shows every major event: "Initial Registration," "Inspection Passed," and "Transfer of Ownership," accompanied by timestamps and the specific Transaction ID for each event.






Figure 4.9.12:  Digital Deed of Sale and Transfer Module

Figure 4.9.12 displays the Transfer of Ownership interface. This module replaces the manual Deed of Sale process. The interface requires the input of the Buyer’s details, the Seller’s consent, and the upload of the scanned Deed of Sale. A status bar indicates the progress of the transfer (e.g., "Pending Approval," "Processing").








Figure 4.9.13: User Management and Role Assignment

Figure 4.9.13 shows the User Management screen. The admin can view active system users and assign specific roles such as LTO Officer, HPG Officer, Insurance Verifier, or Standard User. The screen allows for the activation or deactivation of accounts to control system access.





Figure 4.9.14: Motor Vehicle Inspection Report (MVIR) Interface

Figure 4.9.14 depicts the Vehicle Inspection module. This form is used by authorized inspectors to input technical details (engine condition, chassis integrity, emission status) and upload the physical MVIR document. The interface includes validation checks to ensure all mandatory technical fields are completed before submission.





Figure 4.9.15: HPG Dashboard

Figure 4.17 It shows advanced statistics of cars that have been confirmed, transfer requests that are pending and suspicious records. The dashboard has quick-access modules to vehicle verification and check of ownership history.




Figure 4.9.16: LTO to HPG Request

Figure 4.9.16 In this screen, it is seen that the agencies are fully integrated and registration or transfer applications made to the LTO automatically pass through the HPG to acquire a necessary clearance. It includes the details of the applicant and the documents that have to be validated by HPG



Figure 4.9.17: Vehicle Verification Step 1: Identification

Figure 4.9.17 The police officer captures the identifying marks of the vehicle, which include the plate number, engine number or the chassis number. The system will then request the blockchain to retrieve the existing digital record to compare it.


Figure 4.9.18: Vehicle Verification Step 2: Record Retrieval

Figure 4.9.18, the system will recreate and show the registration history and the current ownership of the vehicle. This is information that is pulled directly off the immutable ledger meaning the officer is working with undamaged information.


Figure 4.9.19: Vehicle Verification Step 3: Document Verification & Matching

Figure 4.9.19 where the officer fills in the results. The officer verifies whether the physical engine and chassis numbers are the same as the blockchain documents. Any gaps encountered at this point can be identified in real-time in the system.


Figure 4.9.20: Vehicle Verification Step 4: Clearance Issuance

Figure 4.9.20 Assuming that the vehicle passes all verifications, the officer will approve the verification, and it will create a digital HPG Clearance and change the transaction status in the blockchain. This is a clearance which is immediately seen by LTO to be registered finally.






Figure 4.9.21: Insurance Dashboard
This interface represents the planned insurance provider portal for future multi-organization deployment. In the pilot implementation, insurance verification was automated through database validation.



Figure 4.9.22: LTO to Insurance Module

Figure 4.9.22 depicts the interface between LTO and Insurance depicting the virtual connection between the government registration and the insurance validation by the private insurance. After a user has registered or transferred a vehicle, a verification request is sent to the insurance module to make sure that the vehicle has a valid Compulsory Third Party Liability (CTPL) cover. The insurance representatives can use this screen to verify the policy information which is automatically recorded on the blockchain and thus the LTO will be approved finally.





Results and Discussion
This section presents the data gathered during the pre-implementation phase of the study. The data describe the current vehicle registration process of the Land Transportation Office (LTO) as experienced by vehicle owners prior to the implementation of the proposed system. Survey responses are organized and presented using weighted mean and verbal interpretation to reflect respondents’ perceptions regarding efficiency, trust, fraud awareness, and system reliability. The results in this section establish a baseline assessment of the existing process and serve as a point of comparison for the post-implementation evaluation discussed in the succeeding sections.

4.1 Pre-Implementation Results
4.1.1 Perceptions of the Current LTO Registration Process
The survey examined vehicle owners' perceptions of the existing LTO registration process in terms of efficiency, staff support, record accuracy, digital accessibility, and transaction speed. This section aimed to identify the strengths and weaknesses of the current system as experienced by citizens, providing a foundation for understanding the operational context in which TrustChain would be deployed.




Table 4.1 presents the weighted mean scores, verbal interpretations, and reliability coefficient for the pre-implementation survey items on perceptions of the current LTO vehicle registration 
process.
Item
Statement
Weighted Mean
Interpretation
1
The current vehicle registration process (LTO) is generally efficient.
2.52
Agree
2
LTO staff provide clear and helpful guidance during registration transactions.
2.42
Disagree
3
Official vehicle records (OR/CR) are generally accurate and trustworthy.
2.74
Agree
4
I find LTO's online services (if I use them) easy to navigate.
2.58
Agree
5
I am satisfied with how quickly registration or renewal transactions are completed.
2.39
Disagree
Overall Weighted Mean
2.53
Agree


Cronbach’s Alpha:0.9157037815
The results presented in Table 4.1 indicate that vehicle owners in Lipa City generally perceived the current LTO vehicle registration process favorably, with an overall weighted mean of 2.53, interpreted as Agree. Among the five items, the statement regarding the accuracy and trustworthiness of official vehicle records obtained the highest weighted mean of 2.74, indicating that respondents generally trust the legitimacy of the OR and CR documents they receive. In contrast, transaction speed and staff guidance recorded lower weighted means of 2.39 and 2.42, respectively, both interpreted as Disagree, suggesting lower satisfaction with these aspects of the registration process. The remaining items related to process efficiency and digital service usability obtained weighted means of 2.52 and 2.58, interpreted as Agree, indicating generally favorable but not strong perceptions of these system attributes.

The observed pattern suggests that while respondents generally trust the accuracy of issued vehicle registration documents, concerns remain regarding the efficiency of the registration process. Lower ratings for transaction speed and staff guidance reflect persistent operational challenges that have been documented in prior studies on LTO service delivery. Existing literature has identified delays and long processing times as recurring issues in LTO transactions (Balcita et al., 2021), as well as limitations in staff responsiveness within Philippine government agencies (Bautista & Siongco, 2017). Although digital initiatives such as the Land Transportation Management System appear to have contributed to moderate improvements in usability and process efficiency, respondents do not perceive these changes as fully addressing systemic inefficiencies. This aligns with broader findings on Philippine e-government platforms, which report ongoing usability and accessibility challenges across agencies (Salvio & Palaoag, 2025).

4.1.2 Awareness and Reporting of Registration Fraud
Table 4.2 presents the weighted mean scores, verbal interpretations, and reliability coefficient for the pre-implementation survey items on awareness and reporting of vehicle registration fraud.
Item
Statement
Weighted Mean
Interpretation
1
I have personally experienced OR/CR or vehicle-registration fraud/forgery.
2.13
Disagree
2
I know someone (friend or family) who has experienced OR/CR or vehicle-registration fraud/forgery.
2.29
Disagree
3
 I feel confident I could identify a forged OR/CR or other fake vehicle document.
2.29
Disagree
4
 I would report suspected OR/CR or registration fraud to the police or LTO.
2.97
Agree
5
I believe reported cases of OR/CR fraud receive appropriate attention from authorities.
2.61
Agree
Overall Weighted Mean
2.46
Disagree


	Cronbach’s Alpha: 0.7037263821
The results presented in Table 4.2 indicate that respondents generally reported low awareness and direct experience with vehicle registration fraud, with an overall weighted mean of 2.49, interpreted as Disagree. Items related to personal experience with registration fraud obtained weighted means of 2.13 and 2.29, suggesting that most respondents had not personally encountered fraudulent OR or CR transactions. Additionally, respondents expressed limited confidence in their ability to identify forged registration documents, as reflected by a weighted mean of 2.29, interpreted as Disagree. In contrast, the item measuring willingness to report suspected fraud obtained a weighted mean of 2.97, interpreted as Agree, indicating a generally positive attitude toward reporting irregularities. Confidence in authorities’ responsiveness to reported fraud received a weighted mean of 2.61, interpreted as Agree, suggesting moderate trust in institutional response mechanisms. The Cronbach’s alpha value of 0.7037 indicates acceptable internal consistency for this section.

The results suggest a gap between respondents’ civic intentions and their practical capability to combat vehicle registration fraud. While most vehicle owners reported limited personal exposure to fraud and low confidence in detecting forged documents, their willingness to report suspected irregularities reflects a sense of civic responsibility. This pattern may be influenced by the technical complexity of modern document forgery and the limited visibility of fraudulent activity to ordinary vehicle owners. Despite existing legal safeguards such as Republic Act No. 10883, which aims to address vehicle-related crimes, recent investigative reports have highlighted vulnerabilities within registration systems, including cases of insider manipulation of ownership records (Philippine Daily Inquirer, 2025; Philstar, 2025; Manila Bulletin, 2025). Furthermore, respondents’ moderate confidence in institutional responsiveness aligns with prior research indicating that public trust in law enforcement is shaped by perceptions of accountability, transparency, and fairness (Alejo-Abitago & Nabe, 2024). Collectively, these findings indicate that although vehicle owners are willing to cooperate with authorities, limitations in detection capability and uncertainty in institutional response remain significant challenges in fraud prevention.




4.1.3 Preferences Toward Blockchain-Based Registration
Table 4.3 presents the weighted mean scores, verbal interpretations, and reliability coefficient for the pre-implementation survey items on preferences toward blockchain-based vehicle registration..
Item
Statement
Weighted Mean
Interpretation
1
I understand, at least in general terms, how blockchain works for securing records.
2.68 
Agree
2
I believe implementing blockchain for vehicle registration would reduce fraud and forgery.
2.97 
Agree
3
I would trust vehicle ownership records more if they were stored on a blockchain-backed system.
2.94
Agree
4
I would be willing to use an online blockchain-based verification service to check a vehicle's OR/CR.
2.97
Agree
5
I prefer a hybrid approach (blockchain + existing LTO systems) rather than a full, immediate switch to blockchain.
2.94
Agree
Overall Weighted Mean
2.90
Agree

	Cronbach’s Alpha: 0.9569882612

Based on the responses in Table 4.3 respondents generally expressed favorable perceptions toward the use of blockchain technology in vehicle registration, with an overall weighted mean of 2.90, interpreted as Agree. Items related to blockchain’s ability to reduce fraud and respondents’ willingness to use blockchain-based verification services both obtained the highest weighted means of 2.97, reflecting positive attitudes toward the technology’s potential application. Trust in blockchain-backed vehicle ownership records and preference for a hybrid implementation approach both recorded weighted means of 2.94, interpreted as Agree. In contrast, the item measuring respondents’ general understanding of blockchain technology obtained a weighted mean of 2.68, also interpreted as Agree, indicating that while respondents view blockchain positively, their technical understanding remains limited. The high Cronbach’s alpha value for this section indicates strong internal consistency among the survey items.

The results suggest that positive perceptions toward blockchain adoption among vehicle owners are driven more by perceived benefits than by technical understanding. Respondents’ confidence in blockchain’s fraud reduction capability and willingness to use verification tools indicate trust in the technology as a safeguard for record integrity, even in the absence of deep technical knowledge. This pattern is consistent with findings from the Philippine Blockchain Report 2025, which reported high levels of trust in blockchain security despite limited public familiarity with the technology (Blockchain Council of the Philippines, 2025). The preference for a hybrid implementation approach further reflects a cautious but pragmatic attitude, where respondents recognize the potential advantages of blockchain while favoring gradual adoption that minimizes disruption to existing services. These findings indicate openness to blockchain-based solutions, while also underscoring the role of institutional trust and user perceptions in shaping technology acceptance.	

4.2 Post-Implementation Evaluation of TrustChain Based on ISO/IEC 25010
The ISO/IEC 25010 evaluation of TrustChain involved a total of 46 evaluators, the majority of whom were end users. This evaluator composition aligns with the study’s emphasis on assessing system quality from the perspective of intended users, particularly with respect to usability, functional suitability, and perceived performance. Accordingly, the results primarily reflect user-centered evaluations of the system’s quality characteristics.


Figure 4.7. Distribution of Evaluators for the ISO/IEC 25010 System Evaluation
Figure 4.7 presents the distribution of evaluators who participated in the ISO/IEC 25010 assessment of the proposed system. A total of 46 respondents evaluated the system, the majority of whom were end users (41 respondents, 89.1%). The remaining evaluators consisted of LTO personnel and authorized staff members, representing institutional and administrative perspectives. This composition indicates that the evaluation results primarily reflect end-user perceptions of system quality.
The predominance of end-user evaluators aligns with the primary focus of this study, which emphasizes usability, functional suitability, and perceived system performance from the perspective of intended users. Given that TrustChain is designed to support vehicle owners in verification and registration-related interactions, end-user feedback provides appropriate and relevant insight into these quality characteristics. While institutional and policy-level concerns such as long-term maintainability and regulatory enforcement were not the primary focus of this evaluation, these aspects may be more thoroughly examined in future assessments involving a larger proportion of LTO personnel and technical experts.
4.2.1 Functional Suitability
Table 4.2.1. Functional Suitability Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system allows me to register a new vehicle efficiently.
3.33
Strongly Agree
2
The system enables accurate transfer of ownership for vehicles.
2.87
Agree
3
The system provides all the functions required for vehicle registration.
3.20
Agree
4
The system generates correct and complete official registration records.
2.85
Agree
5
Workflow steps (submission, verification, approval) are logically organized.
3.11
Agree
6
The system prevents errors during registration or ownership transfer.
3.07
Agree
Overall Weighted Mean
3.07
Agree

The results for Functional Suitability indicate that TrustChain performed well in delivering its intended features and functions. The computed overall mean falls within the Agree to Strongly Agree range, suggesting that evaluators perceived the system as capable of supporting core vehicle registration and ownership verification tasks. High ratings across individual items indicate that essential system functions—such as record generation, ownership validation, and transaction handling—were consistently recognized as present and operational.
These findings suggest that TrustChain adequately addresses the functional requirements identified during the pre-implementation analysis, particularly the need for automated and reliable validation of vehicle ownership records. From an end-user perspective, the system was perceived as functionally complete, indicating that its design aligns with expected registration workflows. This level of functional suitability supports the feasibility of using blockchain-backed systems to replace or augment manual registration processes that rely heavily on human intervention.






4.2.2 Performance Efficiency
Table 4.2.2. Performance Efficiency Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system responds quickly when performing registration tasks.
3.22
Agree
2
Transactions (submission, verification, or transfer) complete in a reasonable time.
3.07
Agree
3
The system handles multiple registration requests without delays.
3.00
Agree
Overall Weighted Mean
3.09
Agree


The evaluation of Performance Efficiency yielded an overall mean interpreted as Agree, indicating that TrustChain was generally perceived to perform efficiently during normal use. Evaluators reported satisfactory response times and transaction processing behavior, suggesting that system interactions such as verification requests and record retrieval were completed without significant delay.

These results imply that TrustChain offers performance improvements relative to traditional registration workflows characterized by manual verification and queue-driven processing. While performance efficiency did not receive the highest ratings among the evaluated characteristics, the findings indicate that the system is sufficiently responsive for its intended use. The slightly lower ratings compared to functional suitability suggest potential areas for optimization, particularly if the system is scaled to accommodate higher transaction volumes.

4.2.3 Compatibility
Table 4.2.3. Compatibility Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system functions properly across different browsers (Chrome, Firefox, Edge, etc.) and devices.
3.37
Stronly Agree
2
Registration data and reports can be exported and used in common formats (PDF, Excel, etc.) when needed.
2.76
Agree
3
The system works smoothly alongside other software tools we use in our office.
2.85
Agree
Overall Weighted Mean
2.99
Agree


The evaluation results for Compatibility indicate that TrustChain was generally perceived as compatible with existing systems and workflows, as reflected by an overall mean interpreted as Agree. Evaluators reported that the system was able to operate alongside current registration processes without causing disruption or requiring extensive changes to existing practices.

These findings suggest that TrustChain can be integrated into the current vehicle registration environment without significant interoperability concerns. From an end-user perspective, compatibility is reflected in the system’s ability to complement existing procedures rather than replace them abruptly. This aligns with the preference expressed in the pre-implementation phase for hybrid approaches that allow gradual adoption of new technologies while maintaining continuity of service.

4.2.4 Usability
Table 4.2.4. Usability Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system is easy to learn for first-time users.
3.15
Agree
2
The interface is clear and intuitive for performing registration tasks.
3.13
Agree
3
Notifications and instructions are understandable and helpful.
3.28
Stronly Agree
4
Performing tasks (registering a vehicle or transferring ownership) is straightforward.
3.04
Agree
5
The system reduces the effort required compared to manual paper-based processes.
3.22
Agree
Overall Weighted Mean
3.17
Agree


Usability received one of the highest overall mean scores among the ISO/IEC 25010 quality characteristics, indicating strong positive perceptions of the system’s interface and ease of use. Evaluators generally agreed that TrustChain was easy to understand, intuitive to navigate, and could be used to complete tasks with minimal assistance.
These findings are particularly significant given that usability concerns were identified as a limitation of existing digital initiatives during the pre-implementation phase. The positive usability ratings suggest that TrustChain successfully addressed common issues related to system complexity and user confusion. This reinforces the importance of user-centered design in public-sector systems, where ease of interaction plays a critical role in adoption and sustained use.

4.2.5 Reliability
Table 4.2.5 Reliability Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system works consistently without unexpected errors.
3.17
Agree
2
Data is correctly saved and remains available after completing transactions.
3.13
Agree
3
The system continues to operate reliably during multiple sessions.
2.96
Agree
Overall Weighted Mean
3.09
Agree


The results for Reliability indicate that TrustChain was perceived as stable and dependable, with an overall mean interpreted as Agree. Evaluators generally reported that the system operated consistently, maintained access to records, and handled interruptions without major issues.
These findings suggest that TrustChain provides a level of operational reliability suitable for a vehicle registration system, where consistent access to records is essential. While the ratings reflect positive perceptions, they also indicate that reliability was viewed as adequate rather than exceptional. This may be attributed to the system’s prototype or pilot nature, suggesting that further testing under extended operational conditions would be beneficial to fully assess long-term system stability.

4.2.6 Security
Table 4.2.6 Security Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
Only authorized users can access sensitive registration data.
3.41
Strongly Agree
2
The system protects data from unauthorized modifications.
3.39
Strongly Agree
3
Ownership records are tamper-proof due to blockchain technology.
3.54
Strongly Agree
4
User actions (registrations and approvals) are traceable and auditable.
3.39
Strongly Agree
5
The system verifies the identity of users correctly before allowing critical actions.
3.54
Strongly Agree
Overall Weighted Mean
3.45
Strongly Agree

Security received the highest overall mean among the evaluated ISO/IEC 25010 characteristics, with results interpreted as Strongly Agree. Evaluators expressed strong confidence in the system’s ability to protect records from unauthorized modification, enforce access control, and preserve the integrity of transaction histories.
These results reflect positive user perceptions of blockchain’s core security properties, particularly immutability and tamper resistance. From the evaluators’ perspective, TrustChain was viewed as significantly more secure than traditional paper-based or semi-digital registration systems. While these findings are perception-based, they nonetheless indicate that blockchain-backed registration systems can strengthen trust in record integrity, which is a critical concern in vehicle ownership management.

4.2.7 Maintainability
Table 4.2.7 Maintainability Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system is structured so that updates or bug fixes can be implemented easily.
3.22
Agree
2
Adding new registration features or rules would be straightforward.
 2.87	
Agree
3
Errors or issues can be quickly identified and resolved.
2.83
Agree
Overall Weighted Mean
2.97
Agree


The Maintainability evaluation yielded an overall mean interpreted as Agree, indicating that evaluators perceived the system as reasonably easy to update, modify, and manage. While most evaluators were not directly involved in system maintenance activities, their responses suggest a general perception that the system is logically structured and adaptable.
These results should be interpreted within the context of the evaluator profile, which was primarily composed of end users rather than technical personnel. As such, the findings reflect perceived maintainability rather than direct technical assessment. Nonetheless, the positive ratings indicate that TrustChain’s design does not appear overly complex from a user standpoint, which is an important consideration for long-term system sustainability in government environments.

4.2.8  Portability
Table 4.2.8 Portability Evaluation of TrustChain
Items
Statement
Weighted Mean
Interpretation
1
The system works properly on different browsers and devices.
3.35	
Strongly Agree
2
 Installing or accessing the system requires minimal technical effort.
3.17	
Agree
3
The system could replace future manual or paper-based registration processes effectively.
2.80
Agree
Overall Weighted Mean
3.11
Agree

Portability received an overall mean within the Agree range, suggesting that evaluators believed TrustChain could be accessed and used across different platforms or environments without significant difficulty. Respondents generally indicated that the system could function effectively regardless of device or access point.

These findings imply that TrustChain demonstrates sufficient portability to support diverse usage contexts, which is particularly relevant for public-sector systems accessed by users with varying levels of technological capability. While the evaluation does not constitute a formal technical portability assessment, the results indicate that users perceived the system as flexible and accessible, supporting broader usability and adoption.




CHAPTER 5
SUMMARY, FINDINGS, CONCLUSIONS, AND RECOMMENDATIONS
This chapter presents the summary of the study, the key findings derived from the pre-implementation survey and post-implementation system evaluation, the conclusions drawn from these findings, and the recommendations for future system development and evaluation of the proposed TrustChain prototype.
5.1 Summary of the Study
This study examined challenges in the existing Land Transportation Office (LTO) vehicle registration process, particularly issues related to transaction delays, fragmented verification workflows, and concerns regarding record integrity. These challenges were contextualized through the concepts of bureaucratic inefficiency and vulnerabilities associated with manual and paper-based validation practices.
To explore potential technological approaches to these issues, the researchers designed and developed TrustChain, a permissioned blockchain-based vehicle registration prototype built using Hyperledger Fabric v2.5 and guided by the Agile Software Development Life Cycle (SDLC). The system architecture was designed to model immutable transaction recording, role-based access control, and automated verification through smart contracts. The prototype simulated workflows for New Vehicle Registration and Transfer of Ownership, including scenarios commonly associated with informal transfer practices such as “pasalo” or “talon.”
The system was evaluated through a pre-implementation survey of vehicle owners and a post-implementation assessment based on the ISO/IEC 25010 software quality model, focusing on user perceptions of system quality characteristics.

5.2 Summary of Findings
A critical analysis of the data highlights significant contrasts between the current LTO registration process and the proposed TrustChain solution, establishing the following key findings:
Perceived Inefficiencies in the Current Registration Process: The study found that the current LTO registration process is hindered by the friction between coexisting systems—the legacy Stradcom database and the modern Land Transportation Management System (LTMS). This was evidenced by the pre-implementation survey results, where respondents gave a "Disagree" rating (Weighted Mean: 2.39) regarding the speed of registration transactions, citing delays in the manual validation of documents across these fragmented platforms.
Verification Efficiency: The "TrustChain" pilot testing demonstrated that cryptographic hashing of CSRs eliminates the need for manual visual verification. By assigning a unique Content Identifier (CID) to every document uploaded during the registration process, the system theoretically reduces the processing time for new registrations by replacing physical cross-checks with algorithmic auto-verification.
Security and Access Control: The implementation of Role-Based Access Control (RBAC) successfully segregated duties between LTO Clerks, HPG Officers, and Vehicle Owners. The findings confirm that restricting write-access to the ledger based on specific MSP (Membership Service Provider) identities effectively prevents the "insider abuse" and unauthorized record alteration described in the problem statement.
Prototype demonstrates technical feasibility but exposes infra and integration gaps. The pilot proved the hybrid architecture (on-chain hash + IPFS off-chain storage, CouchDB for state queries) is viable; however, single-server simulations revealed connectivity/stability limitations and the need for distributed peer hosting and orchestration at production scale.
5.3 Conclusions
Based on the findings, the following conclusions are drawn:
Blockchain can materially improve record integrity in vehicle registration. The TrustChain proof-of-concept shows that a permissioned ledger combined with on-chain hashing of documents makes duplicate or illicit retitling substantially more difficult than current paper/semi-digital workflows. This directly addresses the original tampering risk.
Operational benefits depend on upstream digitization by manufacturers and importers and effective integration with legacy systems. TrustChain’s guarantees are only as strong as the origin of the records it receives. As such, digitizing Certificates of Stock Report (CSRs) at the point of CSR issuance by accredited manufacturers, assemblers, and importers as the primary source of truth, along with the development of middleware to interface with legacy datasets, are identified as necessary preconditions for a blockchain-based registration system to fully mitigate risks associated with technical carnapping.
A staged/hybrid rollout is the most realistic adoption path. Institutional readiness and system interoperability constraints mean that a phased pilot (district-level onboarding, legacy bridge) is more feasible and less disruptive than aggressive central replacement.
Security and user acceptance are strong, but operations & infra require strengthening before production scale. User and LTO staff evaluations show strong perceived security and functionality; nevertheless, operational hardening (node distribution, K8s orchestration, automated key rotation, backups) is necessary prior to any broader deployment.

5.4 Comparative Analysis of Traditional LTO Registration Workflow and the TrustChain System
5.4.1 Basis of the Comparative Analysis

This comparative analysis examines differences between the traditional paper-based and semi-digital vehicle registration workflow of the Land Transportation Office (LTO) and the proposed TrustChain blockchain-integrated workflow. The comparison is conducted at the process and workflow level under controlled prototype testing scenarios. It does not involve live deployment, time-motion studies, or measurement of actual transaction durations. Instead, the analysis focuses on structural workflow characteristics, verification mechanisms, and points of control that influence efficiency, transparency, and record integrity.

5.4.2 Comparative Workflow Table
Table 5.1. Comparative Analysis of Traditional LTO Registration and TrustChain Workflow
Aspect
Traditional LTO Registration Workflow
TrustChain Blockchain-Integrated Workflow
Core Registration Platform
LTMS operating alongside the legacy Stradcom system
Permissioned blockchain network (Hyperledger Fabric)
Certificate of Stock Reported (CSR)
Exists in both paper-based and digitized formats
CSR records, previously registered by manufacturers/importers, are initialized in the system as unassigned vehicle records
Source of Truth
Fragmented across documents and databases
Single append-only ledger as authoritative record
Document Verification
Manual visual inspection of PDF certificates and physical records
Cryptographic hash-based verification
Approval and Rejection
Human-dependent approval based on document comparison
System-enforced validation through smart contracts
Ownership History
Stored across multiple systems and subject to manual updates
Chronologically recorded and immutable
Insider Access Control
Broad access within institutional roles
Role-Based Access Control enforced by MSP identities
Detection of Alterations
Relies on audits and human review
Hash mismatch immediately reveals tampering
Workflow Dependencies
Multiple handoffs between offices and systems
Consolidated verification logic
Registration Mode
Sequential processing with queue-dependent validation
Automated validation under controlled testing scenarios
Evaluation Context
Existing operational system
High-fidelity prototype under controlled conditions


5.4.3 Interpretation of Workflow Differences
The comparative analysis highlights fundamental differences in how vehicle registration transactions are validated and recorded across the two workflows. In the traditional LTO process, verification depends on manual inspection of paper-based and digitized documents, as well as coordination between the LTMS and legacy Stradcom systems. This dual-system arrangement necessitates repeated cross-checking and increases reliance on human judgment during approval and rejection stages.

In contrast, the TrustChain workflow shifts verification from manual inspection to system-enforced validation. By applying cryptographic hashing to the Certificate of Stock Reported when submitted by applicants during vehicle registration, the system enables algorithmic verification of document authenticity prior to any ownership state change. This reduces dependence on visual comparison and limits opportunities for inconsistencies to be introduced during inter-office handoffs.

5.4.4 Relationship to Technical Carnapping Cases Identified in Chapter 4
The workflow-level differences identified in this analysis directly address the procedural conditions associated with reported cases of “technical carnapping” discussed in the pre-implementation findings. Documented incidents of unauthorized ownership transfers were enabled by manual record cancellation, fragmented databases, and insider write-access within existing workflows. These conditions allow altered or duplicate records to be processed as legitimate registrations.

The TrustChain workflow constrains these vulnerabilities by enforcing a single ownership history, restricting write-access through role-based permissions, and requiring cryptographic verification before any transaction is recorded on the ledger. While the present study does not empirically measure fraud reduction in a live operational environment, the redesigned workflow structurally limits the mechanisms through which unauthorized ownership transfers can occur. As such, the proposed system responds directly to the process-level weaknesses that enable technical carnapping, as identified in both the literature and pre-implementation survey results.
5.4.5 Implications of the Comparative Analysis
Although actual processing times were not measured, the comparative analysis indicates that the TrustChain workflow has the potential to reduce procedural complexity by consolidating verification steps and minimizing manual intervention. By establishing the CSR as the source of truth at the manufacturer/importer level—where vehicle identity is first established—the system introduces early validation that strengthens data integrity throughout the registration lifecycle.

These findings suggest that workflow redesign, rather than full system replacement, may offer a practical pathway for improving registration efficiency and record integrity within existing institutional constraints. The comparative analysis therefore supports the feasibility of gradual, hybrid integration of blockchain-based verification mechanisms alongside current LTO systems.

5.5 Recommendations
In light of the findings and conclusions derived from the study, the researchers offer the following recommendations:
For the Land Transportation Office (LTO):
Development of "Legacy Bridge" Middleware: It is recommended to prioritize the development of a middleware layer that connects the existing Stradcom database with the new blockchain network. This "Legacy Bridge" would allow historical SQL-based records to be fed into the distributed ledger gradually, accommodating the agency's current reliance on legacy infrastructure while establishing a path toward full data migration.
Pilot Implementation in Specific Districts: The agency should explore interoperability frameworks that allow gradual integration of distributed ledger technologies with existing registration databases. This allows for the calibration of the existing system to slowly integrate blockchain-based verification mechanisms without disrupting ongoing operations, while enabling incremental validation of data integrity, workflow compatibility, and institutional readiness under controlled pilot conditions.

For System Administrators:
Infrastructure Scaling and Multi-Organization Deployment: To address the connectivity instability (e.g., "502 Bad Gateway" errors) observed during the single-server simulation, it is recommended to migrate from the current Docker Compose environment to a cloud-native Kubernetes (K8s) orchestration. Crucially, this deployment should be distributed across different stakeholders—allowing the LTO, PNP-HPG, and Insurance Commission to host their own independent Peer Nodes to achieve true architectural decentralization and High Availability (HA).
Automated Key Rotation and Backup Strategy: While the blockchain ledger is immutable, off-chain components (PostgreSQL and IPFS nodes) require redundant backups. Administrators should implement an automated policy for rotating cryptographic keys and certificates (MSP) every 90 days to ensure long-term network security and data sovereignty.


For Future Researchers:
Full Backend and Mobile App Integration: Future studies should focus on transitioning the system from a high-fidelity prototype to a fully functional production build. This entails fully implementing the Node.js backend to handle real-time chaincode execution and developing a citizen-facing mobile application that allows vehicle owners to view their "Blockchain OR/CR" directly from their smartphones using the "owner.vin" query.
Multi-Organization Service Integration and Hotlist Management: Future studies should explore transitioning from simulated organizational participation to active multi-stakeholder deployment, where HPG and insurance providers operate dedicated system interfaces for certificate issuance and verification. This includes expanding chaincode to support vehicle flagging logic, allowing PNP-HPG to mark vehicles as "STOLEN" or "CARNAPPED" directly on the blockchain with automatic transaction freezing. Implementing hash-based automated certificate validation and investigating the operational challenges of inter-agency coordination in blockchain-based government service delivery would further enhance system security and processing efficiency.
