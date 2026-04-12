



1) we should be able to see more insights on what is happening with the agents
2) it shows thinking, then disappears unless we reload the chat thread; so there's something wrong with the exit condition
3) we can't see if it's delegated or used tools
4) we can't see what sort of memories we have build - what our knowledge is (if any) - we need to see this and be able to edit it.
5) how do our agents learn and adapt to our personality, our style, our needs?


I want to create a set of business coach agents. Each agent will be focused on different aspects of the business. They should leverage a secure agentic deployment framework with memory that can evolve as the user and their business evolves.

Coaches I want to create:
Founder coach - Looks at personal goals - unicorn aspirations, profitable from day 1, passive/active, etc. Uses this to inform other agents. Helps keep founder focused and tracked on their goals
Strategy coach - Makes sure the business strategy is sound and the actions are aligned to the strategy. Helps set up KPIs/OKRs etc to track. 
Funding coach - looks at all the possible ways of funding - VC, PE, angel, bootstrapping (sales, consulting), debt, etc. Helps prepare and guide based on personal goals and strategy.
Finance coach - helps ensure the systems of controls and finance are sound. Makes sure you're compliant across tax and regulatory operational jurisdictions and helps look for ways to optimize. Also looks at risk, insurance, etc.
Legal coach - reviews all business transactions and contracts and makes suggestions to keep things aligned.
Growth coach - helps figure out GTM/sales/marketing strategies
Technology coach - an expert who can help design and architect systems for internal and external users. 

These coaches can work independently or together as part of an AI-Native executive team for a business or business unit.

Implementation wise, we should be able to run these coaches locally or in a private cloud. We should be able to provide access to the coaches as a service. 

We need to research all the different ways we can do this. Ideally, I would like these coaches to be AI provider agnostic. E.g. we can run them locally on busibox, we can run them in the cloud (using Claude Managed Agents - new), we could run them using OpenClaw/ZeroClaw/NemoClaw, they could be MCP servers....

Once we build these, we are going to deploy them using whatever option is easiest, then we're going to try to create an AI-Native business with them.

The business is around providing an LLM/FinOps control as a service. If you're running LiteLLM or Bifrost or any other LLM proxy layer you can hook in this agent which will monitor spend and make recommendations and/or implement controls in real time to achieve governance, budget and security objectives.


Sundai Club Project Pitches

Executive Team on CMA 
Interested in building on Claude Managed Agents? I've created an MVP of an agentic executive team that runs on CMA. Use it to test your ideas out today, help make it better by incorporating cool MCP servers, skills, etc. It can use notion, slack, google workspace already... 

Agentic Cost Control
