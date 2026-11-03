"""tests/test_execution_plan.py — Test ShowPlanXML parser and execution plan endpoint."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.execution_plan_service import parse_execution_plan

client = TestClient(app)

SAMPLE_SHOWPLAN_XML = """<?xml version="1.0" encoding="utf-8"?>
<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan" Version="1.5" Build="15.0.2000.5">
  <BatchSequence>
    <Batch>
      <Statements>
        <StmtSimple StatementText="SELECT c.CustomerName, o.TotalAmount FROM Customers c INNER JOIN Orders o ON c.CustomerID = o.CustomerID WHERE o.OrderDate &gt;= '2026-01-01'" StatementType="SELECT" StatementSubTreeCost="0.0452" StatementOptmLevel="FULL">
          <QueryPlan CompileCPU="12" CompileMemory="512">
            <MissingIndexes>
              <MissingIndexGroup Impact="68.4">
                <MissingIndex Database="[SalesDB]" Schema="[dbo]" Table="[Orders]">
                  <ColumnGroup Usage="EQUALITY">
                    <Column Name="[CustomerID]"/>
                  </ColumnGroup>
                  <ColumnGroup Usage="INEQUALITY">
                    <Column Name="[OrderDate]"/>
                  </ColumnGroup>
                  <ColumnGroup Usage="INCLUDE">
                    <Column Name="[TotalAmount]"/>
                  </ColumnGroup>
                </MissingIndex>
              </MissingIndexGroup>
            </MissingIndexes>
            <RelOp NodeId="0" PhysicalOp="Nested Loops" LogicalOp="Inner Join" EstimateRows="145" EstimateIO="0.001" EstimateCPU="0.005" EstimatedTotalSubtreeCost="0.0452">
              <OutputList>
                <ColumnReference Column="CustomerName"/>
                <ColumnReference Column="TotalAmount"/>
              </OutputList>
              <NestedLoops>
                <RelOp NodeId="1" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="50" EstimateIO="0.021" EstimateCPU="0.003" EstimatedTotalSubtreeCost="0.024">
                  <OutputList>
                    <ColumnReference Column="CustomerID"/>
                    <ColumnReference Column="CustomerName"/>
                  </OutputList>
                  <IndexScan>
                    <Object Database="[SalesDB]" Schema="[dbo]" Table="[Customers]" Index="[PK_Customers]"/>
                  </IndexScan>
                </RelOp>
                <RelOp NodeId="2" PhysicalOp="Index Seek" LogicalOp="Index Seek" EstimateRows="3" EstimateIO="0.015" EstimateCPU="0.001" EstimatedTotalSubtreeCost="0.016">
                  <OutputList>
                    <ColumnReference Column="TotalAmount"/>
                  </OutputList>
                  <IndexScan>
                    <Object Database="[SalesDB]" Schema="[dbo]" Table="[Orders]" Index="[IX_Orders_CustomerID]"/>
                    <SeekPredicates>
                      <SeekPredicate>c.CustomerID = o.CustomerID</SeekPredicate>
                    </SeekPredicates>
                  </IndexScan>
                </RelOp>
              </NestedLoops>
            </RelOp>
          </QueryPlan>
        </StmtSimple>
      </Statements>
    </Batch>
  </BatchSequence>
</ShowPlanXML>
"""


def test_parse_execution_plan_xml():
    """Test parse_execution_plan accurately parses RelOp tree and missing index."""
    plan = parse_execution_plan(plan_xml=SAMPLE_SHOWPLAN_XML)
    assert plan.statement_type == "SELECT"
    assert "Customers" in plan.query_text
    assert plan.total_cost == 0.0452
    assert plan.missing_index is not None
    assert plan.missing_index.impact_percent == 68.4
    assert "IX_Orders_CustomerID" in plan.missing_index.create_statement

    assert plan.root_operator is not None
    assert plan.root_operator.physical_op == "Nested Loops"
    assert len(plan.root_operator.children) == 2
    assert plan.root_operator.children[0].physical_op == "Clustered Index Scan"
    assert plan.root_operator.children[1].physical_op == "Index Seek"


def test_plan_parse_endpoint():
    """Test POST /api/query-performance/plan-parse endpoint."""
    response = client.post(
        "/api/query-performance/plan-parse",
        json={"plan_xml": SAMPLE_SHOWPLAN_XML},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["statement_type"] == "SELECT"
    assert data["total_cost"] == 0.0452
    assert data["missing_index"] is not None
    assert data["root_operator"]["physical_op"] == "Nested Loops"
    assert len(data["root_operator"]["children"]) == 2


def test_plan_parse_empty():
    """Test endpoint with empty request returns clean safe response."""
    response = client.post("/api/query-performance/plan-parse", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["statement_type"] == "N/A"
    assert data["total_cost"] == 0.0
